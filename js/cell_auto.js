let ruleSet = 182;
let rule;
let cells = [];
let w = 5;
let y=0;
let p = 0;




function setup(){
    createCanvas(600, 1800);
    
    setVal;
    input = createInput();
    input.position(20, 30);
    button = createButton("submit");
    button.position(160, 30);
    button.mousePressed(setVal);
}

function setVal(){
    ruleSet = int(input.value());
    if (ruleSet>=0 && ruleSet<256){
        p=0;
        y=45;
        background(255);
        rule = ruleSet.toString(2).padStart(8, "0");
        let total = width/w;
        for (let i = 0; i < total; i++) {
            cells[i] = 0;  
        }
        cells[floor(total/2)] = 1;
    }
}


function draw(){
    if (p<100)
    {for (let i = 0; i < cells.length; i++) {
        let x = i*w;
        noStroke();
        fill(255-cells[i]*255);
        square(x, y, w);
    }
    y+=w;
    let nextCells = [];
    let len = cells.length;
    for (let i = 0; i < len; i++) {
        let left = cells[(i-1+len)%len];
        let right = cells[(i+1+len)%len];
        let state = cells[i];
        let newState = calcGen(left, state, right);
        nextCells[i] = newState;
    }
    cells = nextCells;}
    p+=1;
}

function calcGen(a, b, c){
    let neighbourhood = ""+a+b+c;
    let value = 7 - parseInt(neighbourhood, 2);
    return parseInt(rule[value]);
}

