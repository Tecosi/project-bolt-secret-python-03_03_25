class AlternativeFinder:
    def __init__(self, material_db):
        """
        Initialize the alternative material finder
        
        Args:
            material_db: MaterialDatabase instance
        """
        self.material_db = material_db
    
    def find_alternatives(self, material_name, dimensions=None, properties=None):
        """
        Find alternative materials based on the original material and requirements
        
        Args:
            material_name (str): Original material name
            dimensions (dict, optional): Part dimensions
            properties (dict, optional): Required properties
            
        Returns:
            list: List of alternative materials with their properties
        """
        # Get the original material
        original_material = self.material_db.get_material_by_name(material_name)
        
        if not original_material:
            # If material not found, return empty list
            return []
        
        # Get all materials
        all_materials = self.material_db.get_all_materials()
        
        # Filter out the original material
        alternatives = [m for m in all_materials if m['id'] != original_material['id']]
        
        # Score each alternative based on similarity and requirements
        scored_alternatives = []
        for alt in alternatives:
            score = self._calculate_similarity_score(original_material, alt, properties)
            alt['similarity_score'] = score
            scored_alternatives.append(alt)
        
        # Sort by similarity score (higher is better)
        scored_alternatives.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        # Take top 5 alternatives
        top_alternatives = scored_alternatives[:5]
        
        # Add comparison data
        for alt in top_alternatives:
            alt['comparison'] = self._compare_materials(original_material, alt, dimensions)
        
        return top_alternatives
    
    def _calculate_similarity_score(self, original, alternative, required_properties=None):
        """
        Calculate similarity score between two materials
        
        Args:
            original (dict): Original material
            alternative (dict): Alternative material
            required_properties (dict, optional): Required properties
            
        Returns:
            float: Similarity score (0-100)
        """
        # Base score
        score = 0
        
        # Properties to compare and their weights
        properties = {
            'tensile_strength': 10,
            'yield_strength': 10,
            'elastic_modulus': 8,
            'thermal_expansion': 5,
            'thermal_conductivity': 5,
            'corrosion_resistance': 7,
            'machinability': 6,
            'weldability': 5
        }
        
        # Adjust weights based on required properties
        if required_properties:
            for prop, value in required_properties.items():
                if prop in properties:
                    properties[prop] += 5  # Increase weight for required properties
        
        # Calculate property similarity
        total_weight = sum(properties.values())
        
        for prop, weight in properties.items():
            if prop in original and prop in alternative and original[prop] is not None and alternative[prop] is not None:
                # For numeric properties
                if isinstance(original[prop], (int, float)) and isinstance(alternative[prop], (int, float)):
                    # Calculate similarity as percentage difference
                    max_val = max(abs(original[prop]), abs(alternative[prop]))
                    if max_val > 0:
                        diff = abs(original[prop] - alternative[prop]) / max_val
                        prop_score = (1 - min(diff, 1)) * 100
                    else:
                        prop_score = 100  # Both values are 0
                # For string properties
                elif isinstance(original[prop], str) and isinstance(alternative[prop], str):
                    if original[prop].lower() == alternative[prop].lower():
                        prop_score = 100
                    else:
                        prop_score = 0
                else:
                    continue
                
                # Add weighted property score
                score += (prop_score * weight / total_weight)
        
        # Bonus for same category
        if original['category'] == alternative['category']:
            score += 10
        
        # Cap score at 100
        return min(score, 100)
    
    def _compare_materials(self, original, alternative, dimensions=None):
        """
        Compare two materials and calculate differences
        
        Args:
            original (dict): Original material
            alternative (dict): Alternative material
            dimensions (dict, optional): Part dimensions
            
        Returns:
            dict: Comparison data
        """
        comparison = {}
        
        # Calculate weight difference
        if dimensions and 'density' in original and 'density' in alternative:
            # Calculate volume if dimensions are available
            if all(key in dimensions for key in ['length', 'width', 'height']):
                volume = dimensions['length'] * dimensions['width'] * dimensions['height']
            else:
                volume = 1000  # Default volume
            
            # Calculate weights
            original_weight = original['density'] * volume / 1000  # kg
            alt_weight = alternative['density'] * volume / 1000  # kg
            
            weight_diff = alt_weight - original_weight
            weight_diff_percent = (weight_diff / original_weight) * 100 if original_weight > 0 else 0
            
            comparison['weight'] = {
                'original': original_weight,
                'alternative': alt_weight,
                'difference': weight_diff,
                'percent_change': weight_diff_percent
            }
        
        # Calculate cost difference
        if 'cost_per_kg' in original and 'cost_per_kg' in alternative:
            if 'weight' in comparison:
                original_cost = original['cost_per_kg'] * comparison['weight']['original']
                alt_cost = alternative['cost_per_kg'] * comparison['weight']['alternative']
            else:
                # Use density as proxy if weight not calculated
                original_cost = original['cost_per_kg'] * original['density']
                alt_cost = alternative['cost_per_kg'] * alternative['density']
            
            cost_diff = alt_cost - original_cost
            cost_diff_percent = (cost_diff / original_cost) * 100 if original_cost > 0 else 0
            
            comparison['cost'] = {
                'original': original_cost,
                'alternative': alt_cost,
                'difference': cost_diff,
                'percent_change': cost_diff_percent
            }
        
        # Compare key mechanical properties
        mechanical_props = ['tensile_strength', 'yield_strength', 'elastic_modulus']
        for prop in mechanical_props:
            if prop in original and prop in alternative and original[prop] is not None and alternative[prop] is not None:
                diff = alternative[prop] - original[prop]
                diff_percent = (diff / original[prop]) * 100 if original[prop] > 0 else 0
                
                comparison[prop] = {
                    'original': original[prop],
                    'alternative': alternative[prop],
                    'difference': diff,
                    'percent_change': diff_percent
                }
        
        return comparison
    
    def get_material_compatibility(self, material1, material2):
        """
        Check compatibility between two materials
        
        Args:
            material1 (str): First material name
            material2 (str): Second material name
            
        Returns:
            dict: Compatibility information
        """
        # Get material data
        mat1 = self.material_db.get_material_by_name(material1)
        mat2 = self.material_db.get_material_by_name(material2)
        
        if not mat1 or not mat2:
            return {'compatible': False, 'reason': 'One or both materials not found'}
        
        # Check for galvanic corrosion (simplified)
        galvanic_series = {
            'Magnesium': 1,
            'Aluminum': 2,
            'Steel': 3,
            'Iron': 3,
            'Nickel': 4,
            'Copper': 5,
            'Titanium': 6
        }
        
        # Get position in galvanic series
        pos1 = None
        pos2 = None
        
        for metal, pos in galvanic_series.items():
            if metal.lower() in mat1['category'].lower():
                pos1 = pos
            if metal.lower() in mat2['category'].lower():
                pos2 = pos
        
        # Check galvanic compatibility
        if pos1 is not None and pos2 is not None:
            galvanic_diff = abs(pos1 - pos2)
            if galvanic_diff >= 2:
                return {
                    'compatible': False,
                    'reason': 'Potential galvanic corrosion risk',
                    'galvanic_difference': galvanic_diff
                }
        
        # Check thermal expansion compatibility
        if 'thermal_expansion' in mat1 and 'thermal_expansion' in mat2:
            thermal_diff = abs(mat1['thermal_expansion'] - mat2['thermal_expansion'])
            if thermal_diff > 10:
                return {
                    'compatible': False,
                    'reason': 'Large difference in thermal expansion coefficients',
                    'thermal_difference': thermal_diff
                }
        
        # Default to compatible
        return {
            'compatible': True,
            'notes': 'Materials appear compatible for most applications'
        }