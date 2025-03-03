// StepViewer.js - A simple 3D viewer for STEP files using Three.js
class StepViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container with id ${containerId} not found`);
      return;
    }

    this.options = Object.assign({
      backgroundColor: 0xf8f9fa,
      partColor: 0xffffaa,
      highlightColor: 0xff9900,
      edgeColor: 0x333333,
      gridVisible: true
    }, options);

    this.init();
  }

  init() {
    // Get container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 400;
    
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.options.backgroundColor);
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 50);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    
    // Add grid
    if (this.options.gridVisible) {
      const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
      gridHelper.rotation.x = Math.PI / 2;
      this.scene.add(gridHelper);
    }
    
    // Add controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Start animation loop
    this.animate();
  }

  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 400;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Load a washer model based on dimensions
  loadWasher(dimensions) {
    // Clear previous models
    this.clearModel();
    
    const outerDiameter = dimensions.length || 30;
    const innerDiameter = dimensions.width * 0.5 || 15;
    const thickness = dimensions.height || 5;
    
    // Create washer geometry
    const washerGeometry = new THREE.RingGeometry(innerDiameter / 2, outerDiameter / 2, 32);
    const washerMaterial = new THREE.MeshStandardMaterial({
      color: this.options.partColor,
      metalness: 0.3,
      roughness: 0.4
    });
    
    const washer = new THREE.Mesh(washerGeometry, washerMaterial);
    
    // Create extrusion for thickness
    const extrudeSettings = {
      steps: 1,
      depth: thickness,
      bevelEnabled: false
    };
    
    const ringShape = new THREE.Shape();
    ringShape.absarc(0, 0, outerDiameter / 2, 0, Math.PI * 2, false);
    
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerDiameter / 2, 0, Math.PI * 2, true);
    ringShape.holes.push(holePath);
    
    // Add bolt holes
    const boltHoleRadius = 1.5;
    const boltHoleDistance = (outerDiameter / 2) * 0.7;
    
    const boltHole1 = new THREE.Path();
    boltHole1.absarc(boltHoleDistance, 0, boltHoleRadius, 0, Math.PI * 2, true);
    ringShape.holes.push(boltHole1);
    
    const boltHole2 = new THREE.Path();
    boltHole2.absarc(-boltHoleDistance, 0, boltHoleRadius, 0, Math.PI * 2, true);
    ringShape.holes.push(boltHole2);
    
    const extrudedGeometry = new THREE.ExtrudeGeometry(ringShape, extrudeSettings);
    const extrudedMesh = new THREE.Mesh(extrudedGeometry, washerMaterial);
    
    // Center the washer
    extrudedMesh.rotation.x = Math.PI / 2;
    extrudedMesh.position.z = -thickness / 2;
    
    // Add edges
    const edges = new THREE.EdgesGeometry(extrudedGeometry);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: this.options.edgeColor }));
    line.rotation.x = Math.PI / 2;
    line.position.z = -thickness / 2;
    
    // Add to scene
    this.scene.add(extrudedMesh);
    this.scene.add(line);
    
    // Center camera
    this.camera.position.set(0, 0, outerDiameter * 1.5);
    this.controls.update();
  }

  // Clear all models from the scene
  clearModel() {
    while(this.scene.children.length > 0) { 
      const object = this.scene.children[0];
      if (object.type === 'GridHelper' || object.type === 'AmbientLight' || object.type === 'DirectionalLight') {
        this.scene.children.shift();
      } else {
        this.scene.remove(object); 
      }
    }
    
    // Re-add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    this.scene.add(directionalLight);
    
    // Re-add grid
    if (this.options.gridVisible) {
      const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
      gridHelper.rotation.x = Math.PI / 2;
      this.scene.add(gridHelper);
    }
  }
}