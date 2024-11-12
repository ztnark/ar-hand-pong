const videoElement = document.getElementById('input-video');
const gameCanvas = document.getElementById('game-canvas');

// Three.js setup
const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: gameCanvas });
renderer.setSize(window.innerWidth, window.innerHeight);

// Create paddles
const paddleGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
const paddleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const leftPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
const rightPaddle = new THREE.Mesh(paddleGeometry, paddleMaterial);

// Position paddles
leftPaddle.position.x = -4;
rightPaddle.position.x = 4;

// Add paddles to scene
scene.add(leftPaddle);
scene.add(rightPaddle);

// Create ball
const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const ball = new THREE.Mesh(ballGeometry, ballMaterial);
scene.add(ball);

// Ball physics
let ballVelocity = {
    x: 0.05,
    y: 0.05
};

// Position camera
camera3D.position.z = 10;

// Create video background
const videoTexture = new THREE.VideoTexture(videoElement);
const backgroundGeometry = new THREE.PlaneGeometry(16, 9);
const backgroundMaterial = new THREE.MeshBasicMaterial({ 
    map: videoTexture,
    side: THREE.DoubleSide
});
const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
backgroundMesh.position.z = -5; // Put it behind everything else
scene.add(backgroundMesh);

// Scale background to fit screen
const resizeBackground = () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    if (aspectRatio > 16/9) {
        backgroundMesh.scale.set(aspectRatio/(16/9), 1, 1);
    } else {
        backgroundMesh.scale.set(1, (16/9)/aspectRatio, 1);
    }
};
resizeBackground();

// Update window resize handler
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera3D.aspect = width / height;
    camera3D.updateProjectionMatrix();
    renderer.setSize(width, height);
    resizeBackground();
});

// Update animation loop to handle video texture
function animate() {
    requestAnimationFrame(animate);
    
    // Update ball position
    ball.position.x += ballVelocity.x;
    ball.position.y += ballVelocity.y;
    
    // Ball collision with top and bottom - reduced to match paddle reach
    if (ball.position.y > 1.8 || ball.position.y < -1.8) {  // Reduced from 3 to 1.8
        ballVelocity.y *= -1;
        // Clamp ball position to prevent sticking
        ball.position.y = ball.position.y > 0 ? 1.8 : -1.8;
    }
    
    // Ball collision with paddles
    if (ball.position.x < leftPaddle.position.x + 0.3 && 
        ball.position.x > leftPaddle.position.x - 0.3 && 
        ball.position.y < leftPaddle.position.y + 0.6 && 
        ball.position.y > leftPaddle.position.y - 0.6) {
        ballVelocity.x *= -1.1;
        ball.position.x = leftPaddle.position.x + 0.3;
    }
    
    if (ball.position.x > rightPaddle.position.x - 0.3 && 
        ball.position.x < rightPaddle.position.x + 0.3 && 
        ball.position.y < rightPaddle.position.y + 0.6 && 
        ball.position.y > rightPaddle.position.y - 0.6) {
        ballVelocity.x *= -1.1;
        ball.position.x = rightPaddle.position.x - 0.3;
    }
    
    // Reset ball if it goes past paddles - adjusted y velocity range
    if (ball.position.x > 6 || ball.position.x < -6) {
        ball.position.set(0, 0, 0);
        ballVelocity = {
            x: (Math.random() > 0.5 ? 0.05 : -0.05),
            y: (Math.random() * 0.06) - 0.03  // Reduced from 0.1 to 0.06
        };
    }
    
    if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        videoTexture.needsUpdate = true;
    }
    renderer.render(scene, camera3D);
}
animate();

// MediaPipe setup (keeping the existing code)
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Setup camera
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720
});

// Start camera
camera.start()
    .catch(err => {
        console.error("Error starting camera:", err);
    });

// Handle hand tracking results
hands.onResults(results => {
    if (results.multiHandLandmarks && results.multiHandedness) {
        results.multiHandedness.forEach((handedness, index) => {
            const landmarks = results.multiHandLandmarks[index];
            const isLeftHand = handedness.label === 'Left';
            const paddle = isLeftHand ? leftPaddle : rightPaddle;
            
            const wrist = landmarks[0];
            // Double the multiplier from 3 to 6 to increase sensitivity
            paddle.position.y = (1 - wrist.y) * 6 - 3; // Changed from 3 to 6 and -1.5 to -3
            // Clamp the paddle position to prevent it from going out of bounds
            paddle.position.y = Math.max(-3, Math.min(3, paddle.position.y));
        });
    }
});