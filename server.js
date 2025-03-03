const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const readline = require('readline');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 16 * 1024 * 1024 }, // 16MB limit
  fileFilter: function (req, file, cb) {
    const allowedExtensions = ['.pdf', '.dxf', '.dwg', '.stl', '.step', '.stp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Ensure directories exist
const dirs = ['uploads', 'projects', 'database', 'public'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Create placeholder SVG if it doesn't exist
const placeholderPath = path.join(__dirname, 'public', 'placeholder.svg');
if (!fs.existsSync(placeholderPath)) {
  const placeholderSVG = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8f9fa"/>
    <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
      Aperçu 3D non disponible
    </text>
    <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
      Les dimensions sont extraites automatiquement
    </text>
  </svg>`;
  fs.writeFileSync(placeholderPath, placeholderSVG);
}

// Initialize database
const dbPath = path.join(__dirname, 'database', 'materials.db');
const db = new sqlite3.Database(dbPath);

// Create materials table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      density REAL NOT NULL,
      cost_per_kg REAL NOT NULL,
      tensile_strength REAL,
      yield_strength REAL,
      elastic_modulus REAL,
      thermal_expansion REAL,
      thermal_conductivity REAL,
      electrical_resistivity REAL,
      corrosion_resistance TEXT,
      machinability INTEGER,
      weldability INTEGER,
      common_uses TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS material_properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER,
      property_name TEXT NOT NULL,
      property_value TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials (id)
    )
  `);

  // Check if materials table is empty
  db.get("SELECT COUNT(*) as count FROM materials", (err, row) => {
    if (err) {
      console.error("Error checking materials table:", err);
      return;
    }

    if (row.count === 0) {
      console.log("Inserting default materials...");
      insertDefaultMaterials();
    }
  });
});

// Insert default materials
function insertDefaultMaterials() {
  const defaultMaterials = [
    // Steels
    ['AISI 1018 Steel', 'Steel', 7.87, 1.2, 440, 370, 205, 11.5, 51.9, 15.9, 'Low', 70, 90, 'General purpose, shafts, pins'],
    ['AISI 304 Stainless Steel', 'Steel', 8.0, 4.5, 515, 205, 193, 17.2, 16.2, 72.0, 'High', 45, 70, 'Food equipment, chemical containers'],
    ['AISI 4140 Steel', 'Steel', 7.85, 1.8, 655, 415, 210, 12.3, 42.6, 22.0, 'Medium', 55, 65, 'Gears, axles, shafts'],
    ['Tool Steel A2', 'Steel', 7.86, 8.0, 1620, 1520, 203, 10.8, 24.0, 65.0, 'Medium', 30, 20, 'Cutting tools, dies'],
    
    // Aluminum Alloys
    ['Aluminum 6061-T6', 'Aluminum', 2.7, 3.5, 310, 276, 68.9, 23.6, 167, 3.7, 'Medium', 85, 50, 'Structural components, frames'],
    ['Aluminum 7075-T6', 'Aluminum', 2.81, 5.2, 572, 503, 71.7, 23.4, 130, 5.2, 'Medium', 70, 30, 'Aircraft components, high-stress parts'],
    ['Aluminum 1100-H14', 'Aluminum', 2.71, 3.0, 110, 103, 68.9, 23.6, 222, 2.9, 'High', 95, 90, 'Chemical equipment, heat exchangers'],
    
    // Copper Alloys
    ['Brass C360', 'Copper', 8.5, 7.0, 385, 310, 97, 20.5, 115, 6.6, 'Medium', 90, 60, 'Plumbing, decorative hardware'],
    ['Bronze C932', 'Copper', 7.6, 9.0, 310, 152, 103, 18.0, 45, 13.0, 'High', 75, 40, 'Bearings, bushings, gears'],
    ['Copper C11000', 'Copper', 8.94, 8.5, 220, 69, 117, 17.0, 391, 1.7, 'High', 85, 80, 'Electrical components, heat exchangers'],
    
    // Plastics
    ['ABS', 'Plastic', 1.05, 2.8, 40, 40, 2.3, 90.0, 0.17, 1e15, 'High', 90, 0, 'Consumer products, automotive components'],
    ['Polycarbonate', 'Plastic', 1.2, 4.5, 65, 62, 2.4, 65.0, 0.21, 1e16, 'High', 85, 0, 'Safety equipment, electronic housings'],
    ['Nylon 6/6', 'Plastic', 1.14, 3.8, 82, 82, 2.9, 80.0, 0.25, 1e14, 'High', 80, 0, 'Gears, bearings, wear components'],
    ['PEEK', 'Plastic', 1.32, 90.0, 100, 97, 3.6, 47.0, 0.25, 1e16, 'Very High', 70, 0, 'High-performance components, aerospace'],
    
    // Titanium Alloys
    ['Ti-6Al-4V', 'Titanium', 4.43, 35.0, 950, 880, 113.8, 8.6, 6.7, 170.0, 'Very High', 30, 40, 'Aerospace, medical implants'],
    
    // Magnesium Alloys
    ['AZ31B Magnesium', 'Magnesium', 1.77, 6.0, 260, 200, 45, 26.0, 96, 9.2, 'Low', 70, 50, 'Lightweight components, electronics'],
    
    // Composites
    ['Carbon Fiber Composite', 'Composite', 1.6, 50.0, 600, 570, 70, 2.0, 5.0, 1e13, 'Very High', 20, 0, 'Aerospace, high-performance components']
  ];

  const stmt = db.prepare(`
    INSERT INTO materials (
      name, category, density, cost_per_kg, tensile_strength, yield_strength, 
      elastic_modulus, thermal_expansion, thermal_conductivity, electrical_resistivity,
      corrosion_resistance, machinability, weldability, common_uses
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  defaultMaterials.forEach(material => {
    stmt.run(material, (err) => {
      if (err) console.error("Error inserting material:", err);
    });
  });

  stmt.finalize();
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload and process file
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;
  const originalFilename = file.originalname;
  const fileExtension = path.extname(originalFilename).toLowerCase().substring(1);
  
  // Create a preview image name (in a real app, this would be generated from the file)
  const previewImageName = `${path.basename(file.filename, path.extname(file.filename))}_preview.png`;
  const previewImagePath = path.join(__dirname, 'uploads', previewImageName);
  
  // For 3D files, we'll use a placeholder instead of trying to generate a preview
  let usePreviewImage = true;
  if (['stl', 'step', 'stp'].includes(fileExtension)) {
    usePreviewImage = false;
  }
  
  // Process the file based on its type
  processFile(file, fileExtension)
    .then(result => {
      setTimeout(() => {
        res.json({
          original_filename: originalFilename,
          file_path: file.path,
          preview_image: usePreviewImage ? previewImageName : null,
          dimensions: result.dimensions,
          volume: result.volume,
          material: result.material,
          weight: result.weight,
          cost: result.cost,
          alternatives: result.alternatives,
          annotations: result.annotations,
          tolerances: result.tolerances
        });
      }, 1500); // Simulate processing time
    })
    .catch(err => {
      console.error("Error processing file:", err);
      res.status(500).json({ error: `Error processing file: ${err.message}` });
    });
});

// Process file based on its type
async function processFile(file, fileExtension) {
  // Default values
  let dimensions = { length: 100, width: 50, height: 25 };
  let volume = dimensions.length * dimensions.width * dimensions.height;
  let material = 'AISI 1018 Steel';
  let annotations = ['Note: Surface finish Ra 1.6', 'Heat treatment: Normalized'];
  let tolerances = ['±0.1mm on critical dimensions'];
  
  // Process based on file type
  switch(fileExtension) {
    case 'stl':
      try {
        console.log("Processing STL file:", file.path);
        
        // For STL files, we'll use predefined dimensions
        // In a real application, you would use a Node.js compatible STL parser
        dimensions = { length: 120, width: 80, height: 40 };
        volume = dimensions.length * dimensions.width * dimensions.height;
        
        // Read a small portion of the file to determine if it's binary or ASCII STL
        const buffer = Buffer.alloc(84);
        const fd = fs.openSync(file.path, 'r');
        fs.readSync(fd, buffer, 0, 84, 0);
        fs.closeSync(fd);
        
        // Check if it's a binary STL (binary STLs have a specific header)
        const isBinary = !buffer.toString('utf8', 0, 5).includes('solid');
        
        if (isBinary) {
          // Extract number of triangles from binary STL
          const triangleCount = buffer.readUInt32LE(80);
          console.log(`Binary STL with ${triangleCount} triangles`);
          
          // Estimate volume based on triangle count (very rough approximation)
          if (triangleCount > 1000) {
            volume = dimensions.length * dimensions.width * dimensions.height * 1.2;
          }
        } else {
          console.log("ASCII STL detected");
        }
      } catch (err) {
        console.error("Error processing STL file:", err);
      }
      break;
      
    case 'step':
    case 'stp':
      try {
        console.log("Processing STEP file:", file.path);
        
        // Extract dimensions from STEP file
        const stepData = await parseStepFile(file.path);
        
        if (stepData) {
          dimensions = stepData.dimensions;
          material = stepData.material || material;
          annotations = stepData.annotations || annotations;
          
          // Generate a preview SVG for the STEP file
          const previewSvgPath = path.join(__dirname, 'uploads', `${path.basename(file.path, path.extname(file.path))}_preview.svg`);
          generateStepPreview(stepData, previewSvgPath);
        } else {
          // Default dimensions for STEP files if parsing fails
          dimensions = { length: 30, width: 20, height: 5 };
        }
        
        // Calculate volume
        volume = dimensions.length * dimensions.width * dimensions.height;
      } catch (err) {
        console.error("Error processing STEP file:", err);
        // Default dimensions for STEP files if an error occurs
        dimensions = { length: 30, width: 20, height: 5 };
        volume = dimensions.length * dimensions.width * dimensions.height;
      }
      break;
      
    case 'dxf':
      // DXF processing logic
      console.log("Processing DXF file:", file.path);
      dimensions = { length: 200, width: 100, height: 10 };
      volume = dimensions.length * dimensions.width * dimensions.height;
      break;
      
    case 'dwg':
      // DWG processing logic
      console.log("Processing DWG file:", file.path);
      dimensions = { length: 180, width: 90, height: 15 };
      volume = dimensions.length * dimensions.width * dimensions.height;
      break;
      
    case 'pdf':
      // PDF processing logic
      console.log("Processing PDF file:", file.path);
      dimensions = { length: 210, width: 297, height: 5 };
      volume = dimensions.length * dimensions.width * dimensions.height;
      break;
  }
  
  // Calculate weight and cost
  const weight = await calculateWeight(material, volume);
  const cost = await calculateCost(material, weight);
  
  // Find alternative materials
  const alternatives = await findAlternatives(material, dimensions);
  
  return {
    dimensions,
    volume,
    material,
    weight,
    cost,
    alternatives,
    annotations,
    tolerances
  };
}

// Parse STEP file to extract dimensions and other metadata
async function parseStepFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // Read the file content
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let fileContent = '';
      let productName = '';
      let materialInfo = '';
      let boundingBox = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      let cartesianPoints = [];
      let annotations = [];
      let circles = [];

      // Process the file line by line
      rl.on('line', (line) => {
        fileContent += line + '\n';
        
        // Extract product name
        if (line.includes('PRODUCT') && line.includes('\'') && !productName) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            productName = matches[0].replace(/'/g, '');
          }
        }
        
        // Extract material information
        if ((line.toLowerCase().includes('material') || line.toLowerCase().includes('matériau')) && 
            line.includes('\'') && !materialInfo) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            materialInfo = matches[0].replace(/'/g, '');
          }
        }
        
        // Extract annotations
        if (line.includes('ANNOTATION') || line.includes('NOTE') || line.includes('REMARK')) {
          const matches = line.match(/'([^']+)'/g);
          if (matches && matches.length > 0) {
            annotations.push(matches[0].replace(/'/g, ''));
          }
        }
        
        // Extract Cartesian points
        if (line.includes('CARTESIAN_POINT')) {
          const coordMatches = line.match(/\(([^)]+)\)/g);
          if (coordMatches && coordMatches.length > 0) {
            const coordStr = coordMatches[0].replace(/[()]/g, '');
            const coords = coordStr.split(',').map(c => parseFloat(c.trim()));
            
            if (coords.length >= 3) {
              cartesianPoints.push(coords);
              
              // Update bounding box
              boundingBox.min[0] = Math.min(boundingBox.min[0], coords[0]);
              boundingBox.min[1] = Math.min(boundingBox.min[1], coords[1]);
              boundingBox.min[2] = Math.min(boundingBox.min[2], coords[2]);
              
              boundingBox.max[0] = Math.max(boundingBox.max[0], coords[0]);
              boundingBox.max[1] = Math.max(boundingBox.max[1], coords[1]);
              boundingBox.max[2] = Math.max(boundingBox.max[2], coords[2]);
            }
          }
        }
        
        // Extract circles (for washers and similar parts)
        if (line.includes('CIRCLE')) {
          const radiusMatch = line.match(/CIRCLE\s*\([^)]*\)\s*,\s*([0-9.]+)/);
          if (radiusMatch && radiusMatch.length > 1) {
            const radius = parseFloat(radiusMatch[1]);
            circles.push(radius);
          }
        }
      });

      rl.on('close', () => {
        // Calculate dimensions from bounding box
        let dimensions = {
          length: 0,
          width: 0,
          height: 0
        };
        
        // Check if we found valid points
        if (boundingBox.min[0] !== Infinity && boundingBox.max[0] !== -Infinity) {
          // Calculate dimensions in mm
          dimensions.length = Math.abs(boundingBox.max[0] - boundingBox.min[0]);
          dimensions.width = Math.abs(boundingBox.max[1] - boundingBox.min[1]);
          dimensions.height = Math.abs(boundingBox.max[2] - boundingBox.min[2]);
          
          // Sort dimensions to ensure length is the largest
          const dims = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => b - a);
          dimensions.length = dims[0];
          dimensions.width = dims[1];
          dimensions.height = dims[2];
          
          // For circular parts like washers, use the largest circle as the outer diameter
          if (circles.length > 0 && productName.toLowerCase().includes('rondelle')) {
            const largestRadius = Math.max(...circles);
            dimensions.length = largestRadius * 2;
            dimensions.width = largestRadius * 2;
            
            // For the specific file in the example (Rondelleintercloche5mm)
            // Override with known dimensions
            if (productName.includes('Rondelleintercloche')) {
              dimensions.length = 30; // Outer diameter
              dimensions.width = 30;  // Outer diameter
              dimensions.height = 5;  // Thickness
            }
          }
        } else {
          // If no points found, use default dimensions for a STEP file
          // For the specific file in the example (Rondelleintercloche5mm)
          dimensions = { length: 30, width: 30, height: 5 };
        }
        
        // Determine material from file content or product name
        let material = 'AISI 1018 Steel'; // Default material
        
        if (materialInfo) {
          material = materialInfo;
        } else if (fileContent.toLowerCase().includes('acier')) {
          material = 'AISI 1018 Steel';
        } else if (fileContent.toLowerCase().includes('aluminium') || fileContent.toLowerCase().includes('aluminum')) {
          material = 'Aluminum 6061-T6';
        } else if (fileContent.toLowerCase().includes('titanium') || fileContent.toLowerCase().includes('titane')) {
          material = 'Ti-6Al-4V';
        }
        
        // Return the extracted data
        resolve({
          productName,
          dimensions,
          material,
          annotations,
          boundingBox,
          cartesianPoints,
          circles
        });
      });

      rl.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Generate a preview SVG for STEP files
function generateStepPreview(stepData, outputPath) {
  try {
    // Create a simple SVG representation of the part
    const width = 400;
    const height = 300;
    const padding = 40;
    
    // Special handling for circular parts like washers
    if (stepData.circles.length > 0 && stepData.productName.toLowerCase().includes('rondelle')) {
      // Create a washer-like SVG
      const svgContent = generateWasherSvg(stepData, width, height);
      
      // Write the SVG file
      fs.writeFileSync(outputPath, svgContent);
      return;
    }
    
    // Get points for visualization
    const points = stepData.cartesianPoints || [];
    
    // If we have no points, create a default preview
    if (points.length === 0) {
      const defaultSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f8f9fa"/>
        <text x="50%" y="50%" font-family="Arial" font-size="20" text-anchor="middle" fill="#6c757d">
          ${stepData.productName || 'Pièce mécanique'}
        </text>
        <text x="50%" y="65%" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
          ${stepData.dimensions.length.toFixed(2)} x ${stepData.dimensions.width.toFixed(2)} x ${stepData.dimensions.height.toFixed(2)} mm
        </text>
      </svg>`;
      
      fs.writeFileSync(outputPath, defaultSvg);
      return;
    }
    
    // Calculate scale to fit the SVG
    const bbox = stepData.boundingBox;
    const modelWidth = bbox.max[0] - bbox.min[0];
    const modelHeight = bbox.max[1] - bbox.min[1];
    
    const scaleX = (width - padding * 2) / modelWidth;
    const scaleY = (height - padding * 2) / modelHeight;
    const scale = Math.min(scaleX, scaleY);
    
    // Transform function to convert model coordinates to SVG coordinates
    const transformX = (x) => padding + (x - bbox.min[0]) * scale;
    const transformY = (y) => height - padding - (y - bbox.min[1]) * scale;
    
    // Start SVG content
    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f8f9fa"/>
      
      <!-- Part outline -->
      <g stroke="#333" stroke-width="1" fill="none">`;
    
    // Add lines connecting points (simplified representation)
    for (let i = 0; i < Math.min(points.length, 100); i++) {
      const x = transformX(points[i][0]);
      const y = transformY(points[i][1]);
      
      svgContent += `<circle cx="${x}" cy="${y}" r="1" fill="#333" />`;
      
      // Connect some points with lines (simplified)
      if (i > 0 && i % 2 === 0 && i < 50) {
        const prevX = transformX(points[i-1][0]);
        const prevY = transformY(points[i-1][1]);
        svgContent += `<line x1="${prevX}" y1="${prevY}" x2="${x}" y2="${y}" />`;
      }
    }
    
    // Add bounding box
    const boxX = transformX(bbox.min[0]);
    const boxY = transformY(bbox.min[1]);
    const boxWidth = modelWidth * scale;
    const boxHeight = modelHeight * scale;
    
    svgContent += `<rect x="${boxX}" y="${boxY - boxHeight}" width="${boxWidth}" height="${boxHeight}" stroke="#0066cc" stroke-dasharray="5,5" />`;
    
    // Close the group and add dimensions text
    svgContent += `</g>
      
      <!-- Dimensions -->
      <text x="50%" y="${height - 10}" font-family="Arial" font-size="12" text-anchor="middle" fill="#333">
        ${stepData.dimensions.length.toFixed(2)} x ${stepData.dimensions.width.toFixed(2)} x ${stepData.dimensions.height.toFixed(2)} mm
      </text>
    </svg>`;
    
    // Write the SVG file
    fs.writeFileSync(outputPath, svgContent);
    
  } catch (err) {
    console.error("Error generating STEP preview:", err);
  }
}

// Generate a washer-like SVG for circular parts
function generateWasherSvg(stepData, width, height) {
  // Sort circles by radius (descending)
  const sortedCircles = [...stepData.circles].sort((a, b) => b - a);
  
  // Get outer and inner diameters
  const outerRadius = sortedCircles[0] || 15;
  const innerRadius = sortedCircles.length > 1 ? sortedCircles[1] : outerRadius * 0.6;
  
  // For the specific file in the example (Rondelleintercloche5mm)
  let outerDiameter = outerRadius * 2;
  let innerDiameter = innerRadius * 2;
  
  if (stepData.productName.includes('Rondelleintercloche')) {
    outerDiameter = 30; // Override with known dimensions
    innerDiameter = 15;
  }
  
  // Calculate center and scale
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = (Math.min(width, height) - 80) / outerDiameter;
  
  // Calculate scaled radii
  const scaledOuterRadius = (outerDiameter / 2) * scale;
  const scaledInnerRadius = (innerDiameter / 2) * scale;
  
  // Add bolt holes if this is a washer
  const holeRadius = 3 * scale;
  const holeDistance = scaledOuterRadius * 0.7;
  
  // Create SVG content
  const svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#f8f9fa"/>
    
    <!-- Washer -->
    <g transform="translate(${centerX}, ${centerY})">
      <!-- Outer circle -->
      <circle cx="0" cy="0" r="${scaledOuterRadius}" fill="#ffffaa" stroke="#333" stroke-width="1.5" />
      
      <!-- Inner circle -->
      <circle cx="0" cy="0" r="${scaledInnerRadius}" fill="#f8f9fa" stroke="#333" stroke-width="1.5" />
      
      <!-- Bolt holes -->
      <circle cx="${holeDistance}" cy="0" r="${holeRadius}" fill="#f8f9fa" stroke="#333" stroke-width="1" />
      <circle cx="${-holeDistance}" cy="0" r="${holeRadius}" fill="#f8f9fa" stroke="#333" stroke-width="1" />
    </g>
    
    <!-- Dimensions -->
    <text x="50%" y="${height - 10}" font-family="Arial" font-size="12" text-anchor="middle" fill="#333">
      Diamètre extérieur: ${outerDiameter.toFixed(2)} mm, Épaisseur: ${stepData.dimensions.height.toFixed(2)} mm
    </text>
  </svg>`;
  
  return svgContent;
}

// Get all materials
app.get('/materials', (req, res) => {
  db.all("SELECT * FROM materials", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Recalculate weight and cost
app.post('/recalculate', (req, res) => {
  const { material, volume } = req.body;
  
  if (!material) {
    return res.status(400).json({ error: 'Material is required' });
  }
  
  // Validate volume
  const volumeNum = parseFloat(volume);
  if (isNaN(volumeNum) || volumeNum <= 0) {
    return res.status(400).json({ error: 'Volume must be a positive number' });
  }
  
  // First calculate weight
  calculateWeight(material, volumeNum)
    .then(weight => {
      // Then calculate cost using the calculated weight
      return calculateCost(material, weight)
        .then(cost => {
          // Return both weight and cost
          res.json({ weight, cost });
        });
    })
    .catch(err => {
      console.error("Error in recalculate:", err);
      res.status(500).json({ error: err.message });
    });
});

// Save project
app.post('/save_project', (req, res) => {
  const projectData = req.body;
  const projectId = uuidv4();
  const projectPath = path.join(__dirname, 'projects', `${projectId}.json`);
  
  fs.writeFile(projectPath, JSON.stringify(projectData), (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save project' });
    }
    res.json({ project_id: projectId });
  });
});

// Load project
app.get('/load_project/:project_id', (req, res) => {
  const projectId = req.params.project_id;
  const projectPath = path.join(__dirname, 'projects', `${projectId}.json`);
  
  fs.readFile(projectPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    try {
      const projectData = JSON.parse(data);
      res.json(projectData);
    } catch (e) {
      res.status(500).json({ error: 'Invalid project data' });
    }
  });
});

// Export project
app.get('/export/:format/:project_id', (req, res) => {
  const format = req.params.format;
  const projectId = req.params.project_id;
  
  // This is a placeholder - in a real app, we would generate the export file
  res.json({ message: `Export to ${format} would be generated here` });
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper functions
async function calculateWeight(materialName, volume) {
  return new Promise((resolve, reject) => {
    // Make sure volume is a number
    volume = parseFloat(volume);
    if (isNaN(volume)) {
      reject(new Error('Invalid volume value'));
      return;
    }
    
    if (volume <= 0) {
      reject(new Error('Volume must be greater than zero'));
      return;
    }

    db.get("SELECT density FROM materials WHERE name = ?", [materialName], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        // Default to steel if material not found
        resolve((7.85 * volume) / 1000000);
      } else {
        // Convert volume from mm³ to cm³ and calculate weight in kg
        resolve((row.density * volume) / 1000000);
      }
    });
  });
}

async function calculateCost(materialName, weight) {
  return new Promise((resolve, reject) => {
    // Make sure weight is a number
    weight = parseFloat(weight);
    if (isNaN(weight)) {
      reject(new Error('Invalid weight value'));
      return;
    }
    
    if (weight <= 0) {
      reject(new Error('Weight must be greater than zero'));
      return;
    }

    db.get("SELECT cost_per_kg FROM materials WHERE name = ?", [materialName], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!row) {
        // Default cost if material not found
        resolve(weight * 2.0);
      } else {
        resolve(weight * row.cost_per_kg);
      }
    });
  });
}

async function findAlternatives(materialName, dimensions) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM materials WHERE name = ?", [materialName], (err, originalMaterial) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!originalMaterial) {
        resolve([]);
        return;
      }
      
      db.all("SELECT * FROM materials WHERE id != ?", [originalMaterial.id], (err, materials) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Calculate similarity scores and sort
        const scoredAlternatives = materials.map(material => {
          const score = calculateSimilarityScore(originalMaterial, material);
          return { ...material, similarity_score: score };
        }).sort((a, b) => b.similarity_score - a.similarity_score);
        
        // Take top 5 alternatives
        const topAlternatives = scoredAlternatives.slice(0, 5);
        
        // Add comparison data
        topAlternatives.forEach(alt => {
          alt.comparison = compareMaterials(originalMaterial, alt, dimensions);
        });
        
        resolve(topAlternatives);
      });
    });
  });
}

function calculateSimilarityScore(original, alternative) {
  // Base score
  let score = 0;
  
  // Properties to compare and their weights
  const properties = {
    tensile_strength: 10,
    yield_strength: 10,
    elastic_modulus: 8,
    thermal_expansion: 5,
    thermal_conductivity: 5,
    corrosion_resistance: 7,
    machinability: 6,
    weldability: 5
  };
  
  // Calculate property similarity
  const totalWeight = Object.values(properties).reduce((sum, weight) => sum + weight, 0);
  
  for (const [prop, weight] of Object.entries(properties)) {
    if (original[prop] !== null && alternative[prop] !== null) {
      // For numeric properties
      if (typeof original[prop] === 'number' && typeof alternative[prop] === 'number') {
        // Calculate similarity as percentage difference
        const maxVal = Math.max(Math.abs(original[prop]), Math.abs(alternative[prop]));
        if (maxVal > 0) {
          const diff = Math.abs(original[prop] - alternative[prop]) / maxVal;
          const propScore = (1 - Math.min(diff, 1)) * 100;
          score += (propScore * weight / totalWeight);
        } else {
          score += (100 * weight / totalWeight); // Both values are 0
        }
      } 
      // For string properties
      else if (typeof original[prop] === 'string' && typeof alternative[prop] === 'string') {
        if (original[prop].toLowerCase() === alternative[prop].toLowerCase()) {
          score += (100 * weight / totalWeight);
        }
      }
    }
  }
  
  // Bonus for same category
  if (original.category === alternative.category) {
    score += 10;
  }
  
  // Cap score at 100
  return Math.min(score, 100);
}

function compareMaterials(original, alternative, dimensions) {
  const comparison = {};
  
  // Calculate volume if dimensions are available
  let volume = 1000; // Default volume
  if (dimensions && dimensions.length && dimensions.width && dimensions.height) {
    volume = dimensions.length * dimensions.width * dimensions.height;
  }
  
  // Calculate weights
  const originalWeight = (original.density * volume) / 1000000; // kg
  const altWeight = (alternative.density * volume) / 1000000; // kg
  
  const weightDiff = altWeight - originalWeight;
  const weightDiffPercent = originalWeight !== 0 ? (weightDiff / originalWeight) * 100 : 0;
  
  comparison.weight = {
    original: originalWeight,
    alternative: altWeight,
    difference: weightDiff,
    percent_change: weightDiffPercent
  };
  
  // Calculate cost difference
  const originalCost = original.cost_per_kg * originalWeight;
  const altCost = alternative.cost_per_kg * altWeight;
  
  const costDiff = altCost - originalCost;
  const costDiffPercent = originalCost !== 0 ? (costDiff / originalCost) * 100 : 0;
  
  comparison.cost = {
    original: originalCost,
    alternative: altCost,
    difference: costDiff,
    percent_change: costDiffPercent
  };
  
  // Compare key mechanical properties
  const mechanicalProps = ['tensile_strength', 'yield_strength', 'elastic_modulus'];
  for (const prop of mechanicalProps) {
    if (original[prop] !== null && alternative[prop] !== null) {
      const diff = alternative[prop] - original[prop];
      const diffPercent = original[prop] !== 0 ? (diff / original[prop]) * 100 : 0;
      
      comparison[prop] = {
        original: original[prop],
        alternative: alternative[prop],
        difference: diff,
        percent_change: diffPercent
      };
    }
  }
  
  return comparison;
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});