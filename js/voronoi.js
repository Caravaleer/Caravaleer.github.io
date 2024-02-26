let points = [];
let delan, voronoi;
let cat;

function preload(){
    cat = loadImage("./images/eye.jpg");
}

function setup() {
    createCanvas(612, 611);
    for (let i = 0; i<10000; i++){
        let x = random(width);
        let y = random(height);
        let col = cat.get(x, y);
        if (random(10) > brightness(col)){
            points.push(createVector(x, y));
        }
        else {
            i--;
        }
        
    }

    delan = calcDel(points);
    voronoi = delan.voronoi([0, 0, width, height]);
}


function draw() {
    background(255);
    for (let v of points){
        stroke(0);
        strokeWeight(3);
        point(v.x, v.y)
    }
    // noFill();
    // strokeWeight(1);
    // let {points, triangles} = delan;
    // for (let i = 0; i < delan.triangles.length; i+=3) {
    //     let a = 2*delan.triangles[i];
    //     let b = 2*delan.triangles[i+1];
    //     let c = 2*delan.triangles[i+2];
    //     triangle(points[a],
    //             points[a+1], 
    //             points[b], 
    //             points[b+1], 
    //             points[c], 
    //             points[c+1]);
    // }

    


    let polygons = voronoi.cellPolygons();
    let cells = Array.from(polygons);
    // for (let poly of cells) {
    //     stroke(0);
    //     strokeWeight(1);
    //     noFill();
    //     beginShape();
    //     for (let i = 0; i< poly.length; i++){
    //         vertex(poly[i][0], poly[i][1]);
    //     }
    //     endShape(); 
    // }

    let centroids = new Array(cells.length);
    let weights = new Array(cells.length).fill(0);
    for (let i =0; i< centroids.length; i++){
        centroids[i] = createVector(0, 0);
    }

    cat.loadPixels();
    let delanIndex = 0;
    for (let i =0; i<width; i++){
        for (let j =0; j<height; j++){
            let index = (i+j*width)*4;
            let r = cat.pixels[index+0];
            let g = cat.pixels[index+1];
            let b = cat.pixels[index+2];
            let bright = (r+g+b)/3;   //should actually be 3
            let weight = 1 - bright/255;
            delanIndex = delan.find(i, j, delanIndex);
            centroids[delanIndex].x += i*weight;
            centroids[delanIndex].y += j*weight;
            weights[delanIndex] += weight;
        }
    }

    for (let i =0; i<centroids.length; i++){
        if (weights[i]>0){
            centroids[i].div(weights[i]);
        }
        else {
            centroids[i] = points[i].copy();
        }
        
    }





    // for (let poly of cells){
    //     let centroid = createVector(0, 0);
    //     let area = 0;
    //     for (let i = 0; i< poly.length; i++){
    //         let v0 = poly[i];
    //         let v1 = poly[(i+1)%poly.length];
    //         let crossVal = v0[0]*v1[1] - v0[1]*v1[0];
    //         area+=crossVal;
    //         centroid.x+=(v0[0]+v1[0])*crossVal;
    //         centroid.y+=(v0[1]+v1[1])*crossVal;
    //     }
    //     area/=2;
    //     centroid.div(6*area);
    //     centroids.push(centroid);
        
    // }

    for (let i = 0; i < points.length; i++){
        points[i].lerp(centroids[i], 0.5);
    }

    delan = calcDel(points);
    voronoi = delan.voronoi([0, 0, width, height]);

}

function calcDel(arr){
    let pointsArr = [];
    for (let v of arr){
        pointsArr.push(v.x, v.y);
    }
    return new d3.Delaunay(pointsArr);
}
