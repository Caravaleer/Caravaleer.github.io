var Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite;

var engine;
var boxes = [];
var world;

var ground;

function setup(){
    createCanvas(600, 600);
    engine = Engine.create();
    world = engine.world;
    Engine.run(engine);
    options = {isStatic: true,

    };
    ground = Bodies.rectangle(300, height, width, 100, options);
    Composite.add(engine.world, [ground]);

}

function mousePressed(){
    
}
function draw(){
    background(100);
    if (mouseIsPressed == true) {
        if (mouseButton == LEFT) {
            boxes.push(new Box(mouseX, mouseY, 20, 20));
        }
    }
    for (var i =0; i<boxes.length; i++){
        boxes[i].show();
    }
    stroke(79);
    fill(79);
    strokeWeight(4);
    rectMode(CENTER)
    rect(300, height, width, 100);
}