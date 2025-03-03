import os
import cv2
import numpy as np
import fitz  # PyMuPDF
import pdfplumber
import ezdxf
from skimage import measure, morphology
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def process_file(filepath, file_extension):
    """
    Process uploaded technical drawing file and extract information
    
    Args:
        filepath (str): Path to the uploaded file
        file_extension (str): File extension (pdf, dxf, dwg)
        
    Returns:
        dict: Extracted information including dimensions, material, annotations, etc.
    """
    logger.info(f"Processing file: {filepath} with extension {file_extension}")
    
    result = {
        'dimensions': {},
        'material': None,
        'annotations': [],
        'tolerances': [],
        'volume': 0,
        'preview_image': None
    }
    
    try:
        if file_extension == 'pdf':
            result = process_pdf(filepath, result)
        elif file_extension == 'dxf':
            result = process_dxf(filepath, result)
        elif file_extension == 'dwg':
            # DWG processing requires additional libraries
            # This is a placeholder for future implementation
            result['error'] = "DWG processing not fully implemented yet"
        else:
            result['error'] = f"Unsupported file extension: {file_extension}"
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        result['error'] = f"Error processing file: {str(e)}"
    
    return result

def process_pdf(filepath, result):
    """Process PDF technical drawings"""
    logger.info("Processing PDF file")
    
    # Extract text for material and annotation information
    with pdfplumber.open(filepath) as pdf:
        text_content = ""
        for page in pdf.pages:
            text_content += page.extract_text() or ""
        
        # Look for material information in text
        material_keywords = ["material:", "matériau:", "steel", "aluminum", "plastic", "acier", "aluminium", "plastique"]
        for keyword in material_keywords:
            if keyword.lower() in text_content.lower():
                # Extract the line containing the material info
                lines = text_content.lower().split('\n')
                for line in lines:
                    if keyword.lower() in line:
                        result['material'] = line.strip()
                        break
        
        # Extract annotations and notes
        result['annotations'] = extract_annotations(text_content)
    
    # Use PyMuPDF for image extraction and dimension analysis
    doc = fitz.open(filepath)
    page = doc[0]  # Assume first page contains the drawing
    
    # Extract image for preview and analysis
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img_path = f"{os.path.splitext(filepath)[0]}_preview.png"
    pix.save(img_path)
    result['preview_image'] = os.path.basename(img_path)
    
    # Process the image to extract dimensions
    img = cv2.imread(img_path)
    if img is not None:
        result = extract_dimensions_from_image(img, result)
    
    # Extract dimensions from PDF annotations if available
    for annot in page.annots():
        if annot.type[0] == 8:  # Dimension annotation
            points = annot.vertices
            if points and len(points) >= 2:
                # Calculate dimension in PDF units (points)
                dim = ((points[1][0] - points[0][0])**2 + (points[1][1] - points[0][1])**2)**0.5
                # Convert to mm (assuming 72 points per inch and 25.4 mm per inch)
                dim_mm = dim * 25.4 / 72
                result['dimensions'][f"dim_{len(result['dimensions'])}"] = dim_mm
    
    # Estimate volume based on dimensions
    result['volume'] = estimate_volume(result['dimensions'])
    
    doc.close()
    return result

def process_dxf(filepath, result):
    """Process DXF technical drawings"""
    logger.info("Processing DXF file")
    
    try:
        # Open the DXF file
        doc = ezdxf.readfile(filepath)
        msp = doc.modelspace()
        
        # Extract entities
        lines = msp.query('LINE')
        circles = msp.query('CIRCLE')
        arcs = msp.query('ARC')
        texts = msp.query('TEXT')
        
        # Process text entities for material and annotations
        for text in texts:
            text_content = text.dxf.text.lower()
            
            # Look for material information
            material_keywords = ["material:", "matériau:", "steel", "aluminum", "plastic", "acier", "aluminium", "plastique"]
            for keyword in material_keywords:
                if keyword.lower() in text_content:
                    result['material'] = text_content
            
            # Look for annotations and tolerances
            if "tolerance" in text_content or "tolérance" in text_content:
                result['tolerances'].append(text_content)
            else:
                result['annotations'].append(text_content)
        
        # Extract dimensions from geometric entities
        dimensions = {}
        
        # Process lines for dimensions
        for i, line in enumerate(lines):
            start = line.dxf.start
            end = line.dxf.end
            length = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5
            dimensions[f"line_{i}"] = length
        
        # Process circles for dimensions
        for i, circle in enumerate(circles):
            radius = circle.dxf.radius
            dimensions[f"circle_{i}_diameter"] = radius * 2
        
        # Find the main dimensions (largest values)
        sorted_dims = sorted(dimensions.items(), key=lambda x: x[1], reverse=True)
        if len(sorted_dims) >= 3:
            result['dimensions'] = {
                'length': sorted_dims[0][1],
                'width': sorted_dims[1][1],
                'height': sorted_dims[2][1] if len(sorted_dims) > 2 else 1.0  # Default height if not found
            }
        elif len(sorted_dims) == 2:
            result['dimensions'] = {
                'length': sorted_dims[0][1],
                'width': sorted_dims[1][1],
                'height': 1.0  # Default height
            }
        elif len(sorted_dims) == 1:
            result['dimensions'] = {
                'length': sorted_dims[0][1],
                'width': sorted_dims[0][1] / 2,  # Estimate
                'height': 1.0  # Default height
            }
        
        # Estimate volume based on dimensions
        result['volume'] = estimate_volume(result['dimensions'])
        
        # Create a preview image
        img_path = f"{os.path.splitext(filepath)[0]}_preview.png"
        create_preview_from_dxf(doc, img_path)
        result['preview_image'] = os.path.basename(img_path)
        
    except Exception as e:
        logger.error(f"Error processing DXF: {str(e)}")
        result['error'] = f"Error processing DXF: {str(e)}"
    
    return result

def extract_annotations(text_content):
    """Extract annotations and notes from text content"""
    annotations = []
    
    # Split text into lines
    lines = text_content.split('\n')
    
    # Keywords that might indicate annotations
    keywords = ["note", "remark", "specification", "spec", "requirement", "req", "finish", "treatment"]
    
    for line in lines:
        line = line.strip()
        if line and any(keyword in line.lower() for keyword in keywords):
            annotations.append(line)
    
    return annotations

def extract_dimensions_from_image(img, result):
    """Extract dimensions from image using computer vision techniques"""
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply threshold
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    
    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Find the largest contour (assuming it's the main part)
    if contours:
        largest_contour = max(contours, key=cv2.contourArea)
        
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Store dimensions (in pixels, would need calibration for real units)
        result['dimensions']['length'] = w
        result['dimensions']['width'] = h
        result['dimensions']['height'] = 10  # Default height, can't determine from 2D image
        
        # Estimate volume
        result['volume'] = estimate_volume(result['dimensions'])
    
    return result

def estimate_volume(dimensions):
    """Estimate volume based on dimensions"""
    if not dimensions:
        return 0
    
    # Simple rectangular prism volume calculation
    length = dimensions.get('length', 0)
    width = dimensions.get('width', 0)
    height = dimensions.get('height', 1)  # Default to 1 if not specified
    
    return length * width * height

def create_preview_from_dxf(doc, output_path):
    """Create a preview image from DXF file"""
    # This is a simplified implementation
    # In a real application, you would render the DXF properly
    
    # Create a blank white image
    img = np.ones((800, 800, 3), dtype=np.uint8) * 255
    
    # Get model space
    msp = doc.modelspace()
    
    # Get all entities
    entities = list(msp)
    
    if not entities:
        cv2.imwrite(output_path, img)
        return
    
    # Find bounding box of all entities
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')
    
    for entity in entities:
        if hasattr(entity, 'dxf') and hasattr(entity.dxf, 'start'):
            min_x = min(min_x, entity.dxf.start[0])
            min_y = min(min_y, entity.dxf.start[1])
            max_x = max(max_x, entity.dxf.start[0])
            max_y = max(max_y, entity.dxf.start[1])
        
        if hasattr(entity, 'dxf') and hasattr(entity.dxf, 'end'):
            min_x = min(min_x, entity.dxf.end[0])
            min_y = min(min_y, entity.dxf.end[1])
            max_x = max(max_x, entity.dxf.end[0])
            max_y = max(max_y, entity.dxf.end[1])
    
    # If we found valid bounds
    if min_x < float('inf'):
        # Calculate scale and offset to fit in image
        width = max_x - min_x
        height = max_y - min_y
        
        scale = min(700 / width, 700 / height) if width > 0 and height > 0 else 1
        offset_x = 50 - min_x * scale
        offset_y = 50 - min_y * scale
        
        # Draw entities
        for entity in entities:
            if entity.dxftype() == 'LINE':
                start_x = int(entity.dxf.start[0] * scale + offset_x)
                start_y = int(entity.dxf.start[1] * scale + offset_y)
                end_x = int(entity.dxf.end[0] * scale + offset_x)
                end_y = int(entity.dxf.end[1] * scale + offset_y)
                
                cv2.line(img, (start_x, start_y), (end_x, end_y), (0, 0, 0), 1)
            
            elif entity.dxftype() == 'CIRCLE':
                center_x = int(entity.dxf.center[0] * scale + offset_x)
                center_y = int(entity.dxf.center[1] * scale + offset_y)
                radius = int(entity.dxf.radius * scale)
                
                cv2.circle(img, (center_x, center_y), radius, (0, 0, 0), 1)
    
    # Save the image
    cv2.imwrite(output_path, img)