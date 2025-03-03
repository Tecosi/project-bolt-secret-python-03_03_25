// Initialize Vue application
const app = Vue.createApp({
    data() {
        return {
            // File upload
            selectedFile: null,
            isAnalyzing: false,
            
            // Analysis results
            analysisResult: null,
            previewImage: null,
            
            // Material data
            materials: [],
            selectedMaterial: null,
            
            // Dimensions and calculations
            dimensions: {
                length: 0,
                width: 0,
                height: 0
            },
            volume: 0,
            weight: 0,
            cost: 0,
            
            // Charts
            weightChart: null,
            costChart: null,
            
            // 3D viewer
            stepViewer: null,
            
            // Project management
            showLoadProjectModal: false,
            projectIdToLoad: '',
            savedProjectId: null,
            
            // Error handling
            showErrorModal: false,
            errorMessage: ''
        };
    },
    
    computed: {
        is3DFile() {
            if (!this.analysisResult || !this.analysisResult.original_filename) return false;
            
            const filename = this.analysisResult.original_filename.toLowerCase();
            return filename.endsWith('.step') || filename.endsWith('.stp');
        }
    },
    
    mounted() {
        // Load materials when the app starts
        this.loadMaterials();
        
        // Initialize Bootstrap components
        this.initBootstrapComponents();
    },
    
    methods: {
        // File handling
        handleFileUpload(event) {
            this.selectedFile = event.target.files[0];
        },
        
        uploadFile() {
            if (!this.selectedFile) {
                this.showError('Veuillez sélectionner un fichier');
                return;
            }
            
            const formData = new FormData();
            formData.append('file', this.selectedFile);
            
            this.isAnalyzing = true;
            
            fetch('/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erreur lors du téléchargement du fichier');
                }
                return response.json();
            })
            .then(data => {
                this.processAnalysisResult(data);
            })
            .catch(error => {
                this.showError('Erreur: ' + error.message);
            })
            .finally(() => {
                this.isAnalyzing = false;
            });
        },
        
        // Process analysis results
        processAnalysisResult(data) {
            this.analysisResult = data;
            
            // Set dimensions
            if (data.dimensions) {
                this.dimensions = {
                    length: parseFloat(data.dimensions.length) || 0,
                    width: parseFloat(data.dimensions.width) || 0,
                    height: parseFloat(data.dimensions.height) || 0
                };
            }
            
            // Set volume, weight and cost
            this.volume = parseFloat(data.volume) || 0;
            this.weight = parseFloat(data.weight) || 0;
            this.cost = parseFloat(data.cost) || 0;
            
            // Set material
            this.selectedMaterial = data.material || 'AISI 1018 Steel';
            
            // Set preview image
            if (data.preview_image) {
                this.previewImage = `/uploads/${data.preview_image}`;
            } else {
                // Check if we have a STEP or STP file
                const fileExt = data.original_filename.split('.').pop().toLowerCase();
                if (['step', 'stp'].includes(fileExt)) {
                    // Try to use the generated SVG preview
                    const baseName = data.file_path.split('/').pop().split('.')[0];
                    this.previewImage = `/uploads/${baseName}_preview.svg`;
                } else if (['stl'].includes(fileExt)) {
                    // Use placeholder for STL files
                    this.previewImage = '/placeholder.svg';
                }
            }
            
            // Initialize charts
            this.$nextTick(() => {
                this.initCharts();
                
                // Initialize 3D viewer for STEP files
                if (this.is3DFile) {
                    this.init3DViewer();
                }
            });
        },
        
        // Reset analysis
        resetAnalysis() {
            this.analysisResult = null;
            this.selectedFile = null;
            this.previewImage = null;
            this.dimensions = { length: 0, width: 0, height: 0 };
            this.volume = 0;
            this.weight = 0;
            this.cost = 0;
            this.savedProjectId = null;
            
            // Destroy charts
            if (this.weightChart) {
                this.weightChart.destroy();
                this.weightChart = null;
            }
            
            if (this.costChart) {
                this.costChart.destroy();
                this.costChart = null;
            }
            
            // Reset file input
            document.getElementById('fileUpload').value = '';
        },
        
        // Load materials
        loadMaterials() {
            fetch('/materials')
            .then(response => response.json())
            .then(data => {
                this.materials = data;
            })
            .catch(error => {
                console.error('Error loading materials:', error);
            });
        },
        
        // Initialize 3D viewer
        init3DViewer() {
            // Destroy existing viewer if it exists
            if (this.stepViewer) {
                // Clean up if needed
            }
            
            // Create new viewer
            this.$nextTick(() => {
                this.stepViewer = new StepViewer('step-viewer', {
                    backgroundColor: 0xf8f9fa,
                    partColor: 0xffffaa
                });
                
                // Load washer model with dimensions
                this.stepViewer.loadWasher(this.dimensions);
            });
        },
        
        // Update 3D viewer
        update3DViewer() {
            if (this.stepViewer && this.is3DFile) {
                this.stepViewer.loadWasher(this.dimensions);
            }
        },
        
        // Recalculate functions
        recalculateVolume() {
            try {
                // Ensure dimensions are numbers
                const length = parseFloat(this.dimensions.length) || 0;
                const width = parseFloat(this.dimensions.width) || 0;
                const height = parseFloat(this.dimensions.height) || 0;
                
                this.volume = length * width * height;
                
                // Only recalculate weight if we have a valid volume
                if (this.volume > 0) {
                    this.recalculateWeight();
                }
                
                // Update 3D viewer if it's a STEP file
                this.update3DViewer();
            } catch (error) {
                console.error('Error calculating volume:', error);
                this.showError('Erreur lors du calcul du volume: ' + error.message);
            }
        },
        
        recalculateWeight() {
            if (!this.selectedMaterial) {
                this.showError('Veuillez sélectionner un matériau');
                return;
            }
            
            if (isNaN(this.volume) || this.volume <= 0) {
                this.showError('Le volume doit être un nombre positif');
                return;
            }
            
            fetch('/recalculate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    material: this.selectedMaterial,
                    volume: parseFloat(this.volume)
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Erreur lors du recalcul');
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                
                this.weight = parseFloat(data.weight) || 0;
                this.cost = parseFloat(data.cost) || 0;
                
                // Update charts
                this.updateCharts();
            })
            .catch(error => {
                console.error('Error recalculating:', error);
                this.showError('Erreur lors du recalcul: ' + error.message);
            });
        },
        
        recalculateAll() {
            this.recalculateVolume();
        },
        
        // Chart functions
        initCharts() {
            this.initWeightChart();
            this.initCostChart();
        },
        
        initWeightChart() {
            const ctx = document.getElementById('weightComparisonChart');
            
            if (!ctx) return;
            
            // Destroy existing chart if it exists
            if (this.weightChart) {
                this.weightChart.destroy();
            }
            
            // Prepare data
            const labels = [this.selectedMaterial];
            const weights = [this.weight];
            const backgroundColors = ['rgba(54, 162, 235, 0.6)'];
            
            // Add alternatives
            if (this.analysisResult && this.analysisResult.alternatives) {
                this.analysisResult.alternatives.forEach(alt => {
                    if (alt.comparison && alt.comparison.weight) {
                        labels.push(alt.name);
                        weights.push(alt.comparison.weight.alternative);
                        
                        // Green for lighter, red for heavier
                        const color = alt.comparison.weight.difference < 0 
                            ? 'rgba(75, 192, 192, 0.6)' 
                            : 'rgba(255, 99, 132, 0.6)';
                        backgroundColors.push(color);
                    }
                });
            }
            
            // Create chart
            this.weightChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Poids (kg)',
                        data: weights,
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(c => c.replace('0.6', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Comparaison de Poids'
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Poids (kg)'
                            }
                        }
                    }
                }
            });
        },
        
        initCostChart() {
            const ctx = document.getElementById('costComparisonChart');
            
            if (!ctx) return;
            
            // Destroy existing chart if it exists
            if (this.costChart) {
                this.costChart.destroy();
            }
            
            // Prepare data
            const labels = [this.selectedMaterial];
            const costs = [this.cost];
            const backgroundColors = ['rgba(54, 162, 235, 0.6)'];
            
            // Add alternatives
            if (this.analysisResult && this.analysisResult.alternatives) {
                this.analysisResult.alternatives.forEach(alt => {
                    if (alt.comparison && alt.comparison.cost) {
                        labels.push(alt.name);
                        costs.push(alt.comparison.cost.alternative);
                        
                        // Green for cheaper, red for more expensive
                        const color = alt.comparison.cost.difference < 0 
                            ? 'rgba(75, 192, 192, 0.6)' 
                            : 'rgba(255, 99, 132, 0.6)';
                        backgroundColors.push(color);
                    }
                });
            }
            
            // Create chart
            this.costChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Coût (€)',
                        data: costs,
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(c => c.replace('0.6', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Comparaison de Coût'
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Coût (€)'
                            }
                        }
                    }
                }
            });
        },
        
        updateCharts() {
            if (this.weightChart && this.costChart) {
                try {
                    // Update current material data
                    this.weightChart.data.datasets[0].data[0] = this.weight;
                    this.costChart.data.datasets[0].data[0] = this.cost;
                    
                    // Update charts
                    this.weightChart.update();
                    this.costChart.update();
                } catch (error) {
                    console.error('Error updating charts:', error);
                }
            }
        },
        
        // Alternative selection
        selectAlternative(materialName) {
            this.selectedMaterial = materialName;
            this.recalculateWeight();
        },
        
        // Project management
        saveProject() {
            if (!this.analysisResult) return;
            
            const projectData = {
                analysisResult: this.analysisResult,
                selectedMaterial: this.selectedMaterial,
                dimensions: this.dimensions,
                volume: this.volume,
                weight: this.weight,
                cost: this.cost
            };
            
            fetch('/save_project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(projectData)
            })
            .then(response => response.json())
            .then(data => {
                this.savedProjectId = data.project_id;
                alert(`Projet enregistré avec succès! ID: ${data.project_id}`);
            })
            .catch(error => {
                this.showError('Erreur lors de l\'enregistrement du projet: ' + error.message);
            });
        },
        
        loadProject() {
            if (!this.projectIdToLoad) {
                this.showError('Veuillez entrer un ID de projet');
                return;
            }
            
            fetch(`/load_project/${this.projectIdToLoad}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Projet non trouvé');
                }
                return response.json();
            })
            .then(data => {
                // Load project data
                this.analysisResult = data.analysisResult;
                this.selectedMaterial = data.selectedMaterial;
                this.dimensions = {
                    length: parseFloat(data.dimensions.length) || 0,
                    width: parseFloat(data.dimensions.width) || 0,
                    height: parseFloat(data.dimensions.height) || 0
                };
                this.volume = parse Float(data.volume) || 0;
                this.weight = parseFloat(data.weight) || 0;
                this.cost = parseFloat(data.cost) || 0;
                
                // Set preview image
                if (this.analysisResult.preview_image) {
                    this.previewImage = `/uploads/${this.analysisResult.preview_image}`;
                } else {
                    // Check if we have a STEP or STP file
                    const fileExt = this.analysisResult.original_filename.split('.').pop().toLowerCase();
                    if (['step', 'stp'].includes(fileExt)) {
                        // Try to use the generated SVG preview
                        const baseName = this.analysisResult.file_path.split('/').pop().split('.')[0];
                        this.previewImage = `/uploads/${baseName}_preview.svg`;
                    } else if (['stl'].includes(fileExt)) {
                        // Use placeholder for STL files
                        this.previewImage = '/placeholder.svg';
                    }
                }
                
                // Close modal
                this.showLoadProjectModal = false;
                
                // Initialize charts
                this.$nextTick(() => {
                    this.initCharts();
                    
                    // Initialize 3D viewer for STEP files
                    if (this.is3DFile) {
                        this.init3DViewer();
                    }
                });
                
                // Set saved project ID
                this.savedProjectId = this.projectIdToLoad;
                this.projectIdToLoad = '';
                
                // Hide modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('loadProjectModal'));
                if (modal) modal.hide();
            })
            .catch(error => {
                this.showError('Erreur: ' + error.message);
            });
        },
        
        // Export results
        exportResults(format) {
            if (!this.analysisResult) return;
            
            const projectId = this.savedProjectId || 'temp';
            
            fetch(`/export/${format}/${projectId}`)
            .then(response => response.json())
            .then(data => {
                alert(data.message);
            })
            .catch(error => {
                this.showError('Erreur lors de l\'export: ' + error.message);
            });
        },
        
        // Error handling
        showError(message) {
            this.errorMessage = message;
            this.showErrorModal = true;
            
            // Initialize modal
            this.$nextTick(() => {
                const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
                errorModal.show();
            });
        },
        
        // Bootstrap initialization
        initBootstrapComponents() {
            // Initialize tooltips
            const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            tooltipTriggerList.map(function (tooltipTriggerEl) {
                return new bootstrap.Tooltip(tooltipTriggerEl);
            });
        }
    }
});

// Mount the Vue application
app.mount('#app');