import sqlite3
import os
import pandas as pd
import json

class MaterialDatabase:
    def __init__(self, db_path):
        """
        Initialize the material database
        
        Args:
            db_path (str): Path to the SQLite database file
        """
        self.db_path = db_path
        self.conn = None
        self.cursor = None
    
    def connect(self):
        """Establish connection to the database"""
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()
    
    def close(self):
        """Close the database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
            self.cursor = None
    
    def initialize_db(self):
        """Initialize the database with tables and default data if it doesn't exist"""
        if not os.path.exists(self.db_path):
            self.connect()
            
            # Create materials table
            self.cursor.execute('''
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
            ''')
            
            # Create material_properties table for additional properties
            self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS material_properties (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                material_id INTEGER,
                property_name TEXT NOT NULL,
                property_value TEXT NOT NULL,
                FOREIGN KEY (material_id) REFERENCES materials (id)
            )
            ''')
            
            # Insert default materials
            self.insert_default_materials()
            
            self.conn.commit()
            self.close()
    
    def insert_default_materials(self):
        """Insert default materials into the database"""
        default_materials = [
            # Steels
            ('AISI 1018 Steel', 'Steel', 7.87, 1.2, 440, 370, 205, 11.5, 51.9, 15.9, 'Low', 70, 90, 'General purpose, shafts, pins'),
            ('AISI 304 Stainless Steel', 'Steel', 8.0, 4.5, 515, 205, 193, 17.2, 16.2, 72.0, 'High', 45, 70, 'Food equipment, chemical containers'),
            ('AISI 4140 Steel', 'Steel', 7.85, 1.8, 655, 415, 210, 12.3, 42.6, 22.0, 'Medium', 55, 65, 'Gears, axles, shafts'),
            ('Tool Steel A2', 'Steel', 7.86, 8.0, 1620, 1520, 203, 10.8, 24.0, 65.0, 'Medium', 30, 20, 'Cutting tools, dies'),
            
            # Aluminum Alloys
            ('Aluminum 6061-T6', 'Aluminum', 2.7, 3.5, 310, 276, 68.9, 23.6, 167, 3.7, 'Medium', 85, 50, 'Structural components, frames'),
            ('Aluminum 7075-T6', 'Aluminum', 2.81, 5.2, 572, 503, 71.7, 23.4, 130, 5.2, 'Medium', 70, 30, 'Aircraft components, high-stress parts'),
            ('Aluminum 1100-H14', 'Aluminum', 2.71, 3.0, 110, 103, 68.9, 23.6, 222, 2.9, 'High', 95, 90, 'Chemical equipment, heat exchangers'),
            
            # Copper Alloys
            ('Brass C360', 'Copper', 8.5, 7.0, 385, 310, 97, 20.5, 115, 6.6, 'Medium', 90, 60, 'Plumbing, decorative hardware'),
            ('Bronze C932', 'Copper', 7.6, 9.0, 310, 152, 103, 18.0, 45, 13.0, 'High', 75, 40, 'Bearings, bushings, gears'),
            ('Copper C11000', 'Copper', 8.94, 8.5, 220, 69, 117, 17.0, 391, 1.7, 'High', 85, 80, 'Electrical components, heat exchangers'),
            
            # Plastics
            ('ABS', 'Plastic', 1.05, 2.8, 40, 40, 2.3, 90.0, 0.17, 1e15, 'High', 90, 0, 'Consumer products, automotive components'),
            ('Polycarbonate', 'Plastic', 1.2, 4.5, 65, 62, 2.4, 65.0, 0.21, 1e16, 'High', 85, 0, 'Safety equipment, electronic housings'),
            ('Nylon 6/6', 'Plastic', 1.14, 3.8, 82, 82, 2.9, 80.0, 0.25, 1e14, 'High', 80, 0, 'Gears, bearings, wear components'),
            ('PEEK', 'Plastic', 1.32, 90.0, 100, 97, 3.6, 47.0, 0.25, 1e16, 'Very High', 70, 0, 'High-performance components, aerospace'),
            
            # Titanium Alloys
            ('Ti-6Al-4V', 'Titanium', 4.43, 35.0, 950, 880, 113.8, 8.6, 6.7, 170.0, 'Very High', 30, 40, 'Aerospace, medical implants'),
            
            # Magnesium Alloys
            ('AZ31B Magnesium', 'Magnesium', 1.77, 6.0, 260, 200, 45, 26.0, 96, 9.2, 'Low', 70, 50, 'Lightweight components, electronics'),
            
            # Composites
            ('Carbon Fiber Composite', 'Composite', 1.6, 50.0, 600, 570, 70, 2.0, 5.0, 1e13, 'Very High', 20, 0, 'Aerospace, high-performance components')
        ]
        
        for material in default_materials:
            self.cursor.execute('''
            INSERT INTO materials (
                name, category, density, cost_per_kg, tensile_strength, yield_strength, 
                elastic_modulus, thermal_expansion, thermal_conductivity, electrical_resistivity,
                corrosion_resistance, machinability, weldability, common_uses
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', material)
    
    def get_all_materials(self):
        """Get all materials from the database"""
        self.connect()
        
        self.cursor.execute('''
        SELECT * FROM materials
        ''')
        
        columns = [desc[0] for desc in self.cursor.description]
        materials = []
        
        for row in self.cursor.fetchall():
            material = dict(zip(columns, row))
            materials.append(material)
        
        self.close()
        return materials
    
    def get_material_by_name(self, name):
        """Get material by name"""
        self.connect()
        
        self.cursor.execute('''
        SELECT * FROM materials WHERE name LIKE ?
        ''', (f'%{name}%',))
        
        columns = [desc[0] for desc in self.cursor.description]
        row = self.cursor.fetchone()
        
        if row:
            material = dict(zip(columns, row))
            self.close()
            return material
        
        self.close()
        return None
    
    def get_materials_by_category(self, category):
        """Get materials by category"""
        self.connect()
        
        self.cursor.execute('''
        SELECT * FROM materials WHERE category = ?
        ''', (category,))
        
        columns = [desc[0] for desc in self.cursor.description]
        materials = []
        
        for row in self.cursor.fetchall():
            material = dict(zip(columns, row))
            materials.append(material)
        
        self.close()
        return materials
    
    def search_materials(self, query):
        """Search materials by name or category"""
        self.connect()
        
        self.cursor.execute('''
        SELECT * FROM materials 
        WHERE name LIKE ? OR category LIKE ?
        ''', (f'%{query}%', f'%{query}%'))
        
        columns = [desc[0] for desc in self.cursor.description]
        materials = []
        
        for row in self.cursor.fetchall():
            material = dict(zip(columns, row))
            materials.append(material)
        
        self.close()
        return materials
    
    def add_material(self, material_data):
        """Add a new material to the database"""
        self.connect()
        
        self.cursor.execute('''
        INSERT INTO materials (
            name, category, density, cost_per_kg, tensile_strength, yield_strength, 
            elastic_modulus, thermal_expansion, thermal_conductivity, electrical_resistivity,
            corrosion_resistance, machinability, weldability, common_uses
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            material_data['name'],
            material_data['category'],
            material_data['density'],
            material_data['cost_per_kg'],
            material_data.get('tensile_strength'),
            material_data.get('yield_strength'),
            material_data.get('elastic_modulus'),
            material_data.get('thermal_expansion'),
            material_data.get('thermal_conductivity'),
            material_data.get('electrical_resistivity'),
            material_data.get('corrosion_resistance'),
            material_data.get('machinability'),
            material_data.get('weldability'),
            material_data.get('common_uses')
        ))
        
        material_id = self.cursor.lastrowid
        
        # Add additional properties if provided
        if 'additional_properties' in material_data:
            for prop_name, prop_value in material_data['additional_properties'].items():
                self.cursor.execute('''
                INSERT INTO material_properties (material_id, property_name, property_value)
                VALUES (?, ?, ?)
                ''', (material_id, prop_name, str(prop_value)))
        
        self.conn.commit()
        self.close()
        
        return material_id
    
    def update_material(self, material_id, material_data):
        """Update an existing material"""
        self.connect()
        
        self.cursor.execute('''
        UPDATE materials SET
            name = ?,
            category = ?,
            density = ?,
            cost_per_kg = ?,
            tensile_strength = ?,
            yield_strength = ?,
            elastic_modulus = ?,
            thermal_expansion = ?,
            thermal_conductivity = ?,
            electrical_resistivity = ?,
            corrosion_resistance = ?,
            machinability = ?,
            weldability = ?,
            common_uses = ?
        WHERE id = ?
        ''', (
            material_data['name'],
            material_data['category'],
            material_data['density'],
            material_data['cost_per_kg'],
            material_data.get('tensile_strength'),
            material_data.get('yield_strength'),
            material_data.get('elastic_modulus'),
            material_data.get('thermal_expansion'),
            material_data.get('thermal_conductivity'),
            material_data.get('electrical_resistivity'),
            material_data.get('corrosion_resistance'),
            material_data.get('machinability'),
            material_data.get('weldability'),
            material_data.get('common_uses'),
            material_id
        ))
        
        # Update additional properties
        if 'additional_properties' in material_data:
            # Delete existing properties
            self.cursor.execute('''
            DELETE FROM material_properties WHERE material_id = ?
            ''', (material_id,))
            
            # Add new properties
            for prop_name, prop_value in material_data['additional_properties'].items():
                self.cursor.execute('''
                INSERT INTO material_properties (material_id, property_name, property_value)
                VALUES (?, ?, ?)
                ''', (material_id, prop_name, str(prop_value)))
        
        self.conn.commit()
        self.close()
        
        return True
    
    def delete_material(self, material_id):
        """Delete a material from the database"""
        self.connect()
        
        # Delete associated properties first
        self.cursor.execute('''
        DELETE FROM material_properties WHERE material_id = ?
        ''', (material_id,))
        
        # Delete the material
        self.cursor.execute('''
        DELETE FROM materials WHERE id = ?
        ''', (material_id,))
        
        self.conn.commit()
        self.close()
        
        return True
    
    def export_materials_to_csv(self, output_path):
        """Export all materials to a CSV file"""
        self.connect()
        
        query = "SELECT * FROM materials"
        df = pd.read_sql_query(query, self.conn)
        
        df.to_csv(output_path, index=False)
        
        self.close()
        
        return output_path
    
    def import_materials_from_csv(self, csv_path):
        """Import materials from a CSV file"""
        df = pd.read_csv(csv_path)
        
        self.connect()
        
        for _, row in df.iterrows():
            material_data = row.to_dict()
            
            # Check if material already exists
            self.cursor.execute('''
            SELECT id FROM materials WHERE name = ?
            ''', (material_data['name'],))
            
            existing_id = self.cursor.fetchone()
            
            if existing_id:
                # Update existing material
                self.update_material(existing_id[0], material_data)
            else:
                # Add new material
                self.add_material(material_data)
        
        self.conn.commit()
        self.close()
        
        return len(df)