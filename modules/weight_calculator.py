class WeightCalculator:
    def __init__(self, material_db):
        """
        Initialize the weight calculator
        
        Args:
            material_db: MaterialDatabase instance
        """
        self.material_db = material_db
    
    def calculate_weight(self, material_name, volume):
        """
        Calculate weight based on material and volume
        
        Args:
            material_name (str): Name of the material
            volume (float): Volume in cubic millimeters
            
        Returns:
            float: Weight in kilograms
        """
        # Get material density
        material = self.material_db.get_material_by_name(material_name)
        
        if not material:
            # Default to steel if material not found
            density = 7.85  # g/cm³ (steel)
        else:
            density = material['density']  # g/cm³
        
        # Convert volume from mm³ to cm³
        volume_cm3 = volume / 1000.0
        
        # Calculate weight in kg
        weight_kg = (density * volume_cm3) / 1000.0
        
        return weight_kg
    
    def calculate_cost(self, material_name, weight_kg):
        """
        Calculate cost based on material and weight
        
        Args:
            material_name (str): Name of the material
            weight_kg (float): Weight in kilograms
            
        Returns:
            float: Cost in currency units
        """
        # Get material cost per kg
        material = self.material_db.get_material_by_name(material_name)
        
        if not material:
            # Default cost if material not found
            cost_per_kg = 2.0  # Default cost per kg
        else:
            cost_per_kg = material['cost_per_kg']
        
        # Calculate total cost
        total_cost = weight_kg * cost_per_kg
        
        return total_cost
    
    def calculate_alternative_weights(self, original_material, volume, alternative_materials):
        """
        Calculate weights for alternative materials
        
        Args:
            original_material (str): Original material name
            volume (float): Volume in cubic millimeters
            alternative_materials (list): List of alternative material names
            
        Returns:
            dict: Dictionary mapping material names to weights
        """
        results = {}
        
        # Calculate weight for original material
        original_weight = self.calculate_weight(original_material, volume)
        results[original_material] = original_weight
        
        # Calculate weights for alternative materials
        for material_name in alternative_materials:
            weight = self.calculate_weight(material_name, volume)
            results[material_name] = weight
        
        return results
    
    def calculate_alternative_costs(self, weights_dict):
        """
        Calculate costs for materials based on weights
        
        Args:
            weights_dict (dict): Dictionary mapping material names to weights
            
        Returns:
            dict: Dictionary mapping material names to costs
        """
        results = {}
        
        for material_name, weight in weights_dict.items():
            cost = self.calculate_cost(material_name, weight)
            results[material_name] = cost
        
        return results
    
    def calculate_weight_savings(self, original_material, alternative_material, volume):
        """
        Calculate weight savings by switching materials
        
        Args:
            original_material (str): Original material name
            alternative_material (str): Alternative material name
            volume (float): Volume in cubic millimeters
            
        Returns:
            dict: Dictionary with weight savings information
        """
        original_weight = self.calculate_weight(original_material, volume)
        alternative_weight = self.calculate_weight(alternative_material, volume)
        
        weight_diff = original_weight - alternative_weight
        weight_diff_percent = (weight_diff / original_weight) * 100 if original_weight > 0 else 0
        
        return {
            'original_weight': original_weight,
            'alternative_weight': alternative_weight,
            'weight_diff': weight_diff,
            'weight_diff_percent': weight_diff_percent
        }
    
    def calculate_cost_savings(self, original_material, alternative_material, volume):
        """
        Calculate cost savings by switching materials
        
        Args:
            original_material (str): Original material name
            alternative_material (str): Alternative material name
            volume (float): Volume in cubic millimeters
            
        Returns:
            dict: Dictionary with cost savings information
        """
        original_weight = self.calculate_weight(original_material, volume)
        alternative_weight = self.calculate_weight(alternative_material, volume)
        
        original_cost = self.calculate_cost(original_material, original_weight)
        alternative_cost = self.calculate_cost(alternative_material, alternative_weight)
        
        cost_diff = original_cost - alternative_cost
        cost_diff_percent = (cost_diff / original_cost) * 100 if original_cost > 0 else 0
        
        return {
            'original_cost': original_cost,
            'alternative_cost': alternative_cost,
            'cost_diff': cost_diff,
            'cost_diff_percent': cost_diff_percent
        }