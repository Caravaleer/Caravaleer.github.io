let stars = [];
let factor = 100;
let hueValue = 200;

function setup() {
    createCanvas(400,400);
    colorMode(HSB, 360, 255, 255);
    for (let i = 0; i<500; i++){
        stars[i] = createVector(
            random(-width*factor, width*factor),
            random(-height*factor, height*factor),
            random(400)
        );
    }
    
}
function draw() {
    background(0);
    fill(hueValue, 255, 255);
    noStroke();
    translate(width/2, height/2);
    for (let star of stars){
        let x = star.x/star.z;
        let y = star.y/star.z;
        let d = map(star.z, 0, 400, 10, 1);
        circle(x, y, d);
        star.z-=2;
        if (star.z<1){
            star.x = random(-width*factor, width*factor);
            star.y = random(-height*factor, height*factor);
            star.z = random(400);
        }
    }
    hueValue+=1;
    if (hueValue>360){
        hueValue = 1;
    }
}