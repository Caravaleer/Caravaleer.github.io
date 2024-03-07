let sketchRNN;
let currentStroke;
let nextPen="down";
let seedPath = [];
let seedPoints = [];
let personDrawing = false;
let x, y;

function preload(){
    sketchRNN = ml5.sketchRNN('cat');
}

function startDraw(){
    personDrawing = true;
    x = mouseX;
    y = mouseY;

}

function startSketchRNN() {
    personDrawing = false;
    const rdpPoints = [];

    const total = seedPoints.length;
    const start = seedPoints[0];
    const end = seedPoints[total-1];
    rdpPoints.push(start);
    rdp(0, total-1, seedPoints, rdpPoints);
    rdpPoints.push(end);

    background(255);
    stroke(0);
    strokeWeight(4);
    beginShape();
    noFill();
    for (let v of rdpPoints){
        vertex(v.x, v.y);
    }
    endShape();

    x = rdpPoints[rdpPoints.length-1].x;
    y = rdpPoints[rdpPoints.length-1].y;
    seedPath = [];

    for (i=1; i<rdpPoints.length; i++){
                let strokePath = {
            dx: rdpPoints[i].x - rdpPoints[i-1].x,
            dy: rdpPoints[i].y - rdpPoints[i-1].y,
            pen: 'down',
        }
        // line(x, y, x+strokePath.dx, y+strokePath.dy);
        // x+=strokePath.dx;
        // y+=strokePath.dy;
        seedPath.push(strokePath);
    }

    sketchRNN.generate(seedPath, gotStrokePath);
}

function setup(){
    let canvas = createCanvas(800, 800);
    canvas.mousePressed(startDraw);
    canvas.mouseReleased(startSketchRNN);
    // x = width/2;
    // y = height/2;
    background(255);
}

function gotStrokePath(error, strokePath){
    currentStroke = strokePath;
    
}

function draw(){
    stroke(0);
    strokeWeight(4);
    if (personDrawing){


        line(mouseX, mouseY, pmouseX, pmouseY);
        seedPoints.push(createVector(mouseX, mouseY));
    }
    if (currentStroke){
        

        if (nextPen == "end"){
            sketchRNN.reset();
            startSketchRNN();
            currentStroke = null;
            nextPen = "down";
            return;
        }
        if (nextPen == "down"){
            line(x, y, x+currentStroke.dx, y+currentStroke.dy);
        }
        nextPen = currentStroke.pen;
        x+=currentStroke.dx;
        y+=currentStroke.dy;
        currentStroke = null;
        sketchRNN.generate(gotStrokePath);
    }
}