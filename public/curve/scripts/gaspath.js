var Gaspath = Gaspath || {};
// name scope:Gaspath
Gaspath.svg = {
  draw: null,
  sheetNumber: 0,
  inputButton: null,
  init: function(id, default_width, default_height, bool=true){
     if(bool){
      let form = document.createElement('form');
      let input = document.createElement('input')
      input.type = "file"
      input.multiple = true;
      form.appendChild(input);
      document.getElementById(id).appendChild(form);
      this.inputButton = input
      Gaspath.reader.set(input);
    }
    this.draw = SVG(id).panZoom({zoomFactor:1.1});
    this.draw.width(default_width);
    this.draw.height(default_height);
    this.draw.attr('preserveAspectRatio', 'xMinYMin slice');
      border: '1px solid #F5F5F5',
      this.draw.style( {
      margin:0,
      padding:0,
      background:'linear-gradient(to bottom, white, RoyalBlue)'
    });
    this.draw.viewbox(0, 0, default_width, default_height).flip("y");
    let background = this.draw.group();
    background.line(0, 0, 1000, 0).fill("none").stroke({color:"black",opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke-dasharray","5 5");
    background.line(0, 0, 0, 1000).fill("none").stroke({color:"black",opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke-dasharray","5 5");
    this.draw.screen = this.draw.group();
    this.draw.screen.background = background;
    this.draw.screen.sheet = [];
  }
}
Gaspath.reader = {
  count:0,
  data: [],
  set: function(obj){
    let self = this;
    obj.addEventListener("change",function(e){
      let filelist = e.target.files;
      let tempData=[];
      let promise = [];
      for(let file of filelist){promise.push(self.readFile(file,tempData))}
      Promise.all(promise).then(()=>self.addData(tempData));
    },false);
  },
  addData: function(addData){
    this.data.push(addData);
    let bladeRows = Gaspath.get.bladeRows(addData,true)
    Gaspath.draw.path(bladeRows);
    console.log(Gaspath.get.blades[this.count]);
    this.count = this.count + 1;
  },
  parseBladeName: function(filename){
    let re = /[L,l]\d+[R,C,r,c]|\d+[c,s,C,S]/;
    return filename.match(re) || "tmp";
  },
  parseHSBName: function(filename){
    if(/shroud|Shroud|SHROUD/.test(filename)){return "shroud"}
    else if(/hub|Hub|HUB/.test(filename)){return "hub"}
    else {return "blade"}
  },
  readFile: function(file,data){
    return new Promise((resolve,reject)=>{
      var self = this;
      let bladeName = self.parseBladeName(file.name)[0];
      let hsb = self.parseHSBName(file.name);

      var reader = new FileReader();
      reader.addEventListener("load",function(e){
        let sections = reader.result
          .split(/\s*#.*/).filter(function(value,index,self){
          return value !="" && value != "\r\n" && value != "\n" && value != "\r";
        });
        let readData = [];
        for(section of sections){
          let sectionData = {x:[],y:[],z:[]};
          let line = section.split(/\r\n|\r|\n/);
          for(let i=0; i<line.length; i=(i+1)|0){
            if(line[i] !=""){
              let xyz = line[i].split(/\s+/).filter(function(value,index,self){
                return value !="";
              });
              sectionData.x.push(xyz[0]);
              sectionData.y.push(xyz[1]);
              sectionData.z.push(xyz[2]);
            }
          }
          readData.push(sectionData);
        }
        if(!data.hasOwnProperty(bladeName)){data[bladeName] = {}}
        if(hsb==="shroud" || hsb==="hub"){data[bladeName][hsb]=readData[0]}
        else {data[bladeName][hsb]=readData}
        reader.removeEventListener("load", arguments.callee, false);
        resolve();
      },false);
      reader.readAsText(file, 'UTF-8');
    });
  }
}

Gaspath.method = {
  vector:{
    fromPoint: function(p1,p2){
      return p2.map(function(value,index,self){return value-p1[index];});
    },
    cross: function(v1, v2){
      return [
        v1[1]*v2[2]-v1[2]*v2[1],
        v1[2]*v2[0]-v1[0]*v2[2],
        v1[0]*v2[1]-v1[1]*v2[0]
      ]
    }
  },
  intersection: {
    line: function(P1, P2, P3, P4) {//linep 1-p2 X line p3-p4
      let p1= P1.concat(0);
      let p2= P2.concat(0);
      let p3= P3.concat(0);
      let p4= P4.concat(0);

      let vec_p1top2 = Gaspath.method.vector.fromPoint(p1, p2);
      let vec_p3top4 = Gaspath.method.vector.fromPoint(p3, p4);
      let vec_p1top3 = Gaspath.method.vector.fromPoint(p1, p3);

      let d = Gaspath.method.vector.cross(vec_p1top2, vec_p3top4)[2];
      if(d==0){return {intersect: false ,u:null, v:null, point:null};} //parallel

      let u = Gaspath.method.vector.cross(vec_p1top3, vec_p3top4)[2]/d;
      let v = Gaspath.method.vector.cross(vec_p1top3, vec_p1top2)[2]/d;

      //     u <0 :intersection point is opposite side of p2 from p1
      // 0 < u <1 :intersection point is not between p1 and p2
      // 1 < u  :intersection point is on the extended line from p1 to p2

      //     v <0 :intersection point is opposite side of p4 from p3
      // 0 < v <1 :intersection point is not between p3 and p4
      // 1 < v  :intersection point is on the extended line from p3 to p4

      let x = p1[0] + u * (p2[0] - p1[0]);
      let y = p1[1] + u * (p2[1] - p1[1]);

      return {intersect: true, u: u, v: v, point:[x,y]}; //return intersection point
    },
    polyline: function(points1, points2){
      let res = [];
      let self=this
      points1.forEach(function(value1, index1, self1){
        if(index1 < self1.length- 1 ){
          let tmp=[]
          let p1 = self1[index1];
          let p2 = self1[index1+1];
          points2.forEach(function(value2, index2, self2){
            if(index2 < self2.length-1){
              let p3 = self2[index2];
              let p4 = self2[index2+1];
              tmp.push(Object.assign(self.line(p1, p2, p3, p4),{index1:index1,index2:index2}));
            }
          });
          res.push(tmp)
        }
      })
      return res;
    }
  }
}

Gaspath.get = {
  blades:[],
  HubShroud: function(curve){
    var path=[]
    for(let i=0; i< curve.y.length; i++){
      path.push([ curve.z[i], curve.y[i] ]);
    }
    return path;
  },
  LeTe: function(curve, minmax){
    let line
    switch(minmax){
      case "min":
        line = curve.map(function(value,index,self){
          let id = value.z.indexOf(Math.min.apply(null,value.z))
          return [value.z[id],value.y[id]]
        });
        break;
      case "max":
        line = curve.map(function(value,index,self){
          let id = value.z.indexOf(Math.max.apply(null,value.z))
          return [value.z[id],value.y[id]]
        });
        break;
    }
    return line;
  },
  shroudCut: function(bladeLine,shroudLine){
    let res = Gaspath.method.intersection.polyline(bladeLine, shroudLine)
    let res2=[]
    for(let any of res){
      for(let any2 of any){
        if(any2.intersect && 0<any2.u && any2.u <=1 && 0<=any2.v && any2.v<=1){
          res2.push(any2)
        }
      }
    }
    if(res2.length>0){
      bladeLine.splice(res2[0].index1+1, bladeLine.length-res2[0].index1,res2[0].point)
    }
  },
  hubCut: function(bladeLine, hubLine){
    res = Gaspath.method.intersection.polyline(bladeLine, hubLine)
    res2=[]
    for(let any of res){
      for(let any2 of any){
        if(any2.intersect && 0<=any2.u && any2.u <1 && 0<=any2.v && any2.v<=1){
          res2.push(any2)
        }
      }
    }
    if(res2.length>0){
      bladeLine.splice(0, res2[0].index1+1,res2[0].point)
    }
  },
  pathCut: function(blade){
    this.shroudCut(blade.le,blade.shroud);
    this.hubCut(blade.le,blade.hub);
    this.shroudCut(blade.te,blade.shroud);
    this.hubCut(blade.te,blade.hub);
  },
  bladeRow: function(blade){
    let newBlade = {
      hub: this.HubShroud(blade.hub),
      shroud: this.HubShroud(blade.shroud),
      le: this.LeTe(blade.blade,"min"),
      te: this.LeTe(blade.blade,"max"),
      in: this.LeTe([blade.hub, blade.shroud],"min"),
      out: this.LeTe([blade.hub, blade.shroud],"max")
    };
    return newBlade;
  },
  bladeRows: function(curvefiles, bool){
    let newBlades={};
    for(let blade in curvefiles){
      newBlades[blade] = this.bladeRow(curvefiles[blade])
      if(bool){this.pathCut(newBlades[blade])}
    }
    this.blades.push(newBlades)
    return newBlades
  },
}

Gaspath.draw = {
  color: ["blue","maroon","green","purple","red","pink","aqua"],
  row: function(svg, blade, color){
    svg.polyline(blade.hub).fill("none").stroke({color:color,opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke");
    svg.polyline(blade.shroud).fill("none").stroke({color:color,opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke");
    svg.polyline(blade.le).fill("none").stroke({color:color,opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke");
    svg.polyline(blade.te).fill("none").stroke({color:color,opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke");
    svg.polyline(blade.in).fill("none").stroke({color:color,opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke-dasharray","5 5");
    svg.polyline(blade.out).fill("none").stroke({color:color,opacity: 1.0,width:1})
    .attr("vector-effect", "non-scaling-stroke")
    .attr("stroke-dasharray","5 5");
  },
  path: function(bladeRows){
    Gaspath.svg.draw.screen.sheet.push(Gaspath.svg.draw.screen.group())
    Gaspath.svg.sheetNumber = Gaspath.svg.draw.screen.sheet.length - 1;
    for(let blade in bladeRows){
      let svg = Gaspath.svg.draw.screen.sheet[Gaspath.svg.sheetNumber];
      let eachBlade = bladeRows[blade];
      let color = this.color[Gaspath.svg.sheetNumber % this.color.length]
      this.row(svg, eachBlade, color)
    }
  }
}
