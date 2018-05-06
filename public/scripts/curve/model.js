
import {view} from "./view.js"
import {jscad} from "/jscad/scripts/jscad/mini.js"
import {importFiles} from "/jscad/scripts/jscad/FileReader.js"

"use strict"

// name scope:Gaspath
export const model = {
  draw: jscad.setup("drawing", 800,500),
  count: 0,
  sheetNumber: 0,
  button:{
    import:{
      execute:function(e){
        const exe = async ()=>{
          const files = await importFiles(view.elements.importFunc)
          const curveDatas = files.map(model.button.import.parse)
          const curves = model.button.import.insert(curveDatas)
          const bladeRows = model.get.bladeRows(curves,true)
          model.drawSVG.path(bladeRows);
          model.count = model.count + 1;
        }
        exe()
      },
      parse: function(file){
        const bladeName = model.reader.parseBladeName(file.filename)[0];
        const hsb = model.reader.parseHSBName(file.filename);
        const sections = file.text 
          .split(/\s*#.*/)
          .filter(value=>{
            return value !="" && value != "\r\n" &&
              value != "\n" && value != "\r"
          })
        const readData = sections.map(section=>{
          const sectionData = {x:[],y:[],z:[]};
          const line = section.split(/\r\n|\r|\n/);
          for(let i=0; i<line.length; i=i+1){
            if(line[i] !=""){
              const xyz = line[i].split(/\s+/)
                .filter(value=>{return value !=""});
              sectionData.x.push(parseFloat(xyz[0]));
              sectionData.y.push(parseFloat(xyz[1]));
              sectionData.z.push(parseFloat(xyz[2]));
            }
          }
          return sectionData
        })
        const curveData = {
          readData: readData,
          bladeName: bladeName,
          hsb: hsb,
        }
        return curveData 
      },
      insert: function(curveDatas){
        const data = {}
        curveDatas.forEach(curveData=>{
          const readData = curveData.readData
          const bladeName = curveData.bladeName
          const hsb = curveData.hsb
          if(!data.hasOwnProperty(bladeName))data[bladeName] = {}

          if(hsb==="shroud" || hsb==="hub")data[bladeName][hsb]=readData[0]
          else data[bladeName][hsb]=readData
        })
        return data
      },
    },
  },
  save : {
    execute: function(){
      const svgString = model.draw.screen.svg()
      this.saveStringAsFile(svgString, 'curve.svg')
    },
    saveStringAsFile: function(string,filename){
      const blob = new Blob([string], {type: 'text/plain; charset=utf-8'})
      saveAs(blob, filename);
    },
  }, 
  reader : {
    parseBladeName: function(filename){
      let re = /[L,l]\d+[R,C,r,c]|\d+[c,s,C,S]/;
      return filename.match(re) || "tmp";
    },
    parseHSBName: function(filename){
      if(/shroud|Shroud|SHROUD/.test(filename)){return "shroud"}
      else if(/hub|Hub|HUB/.test(filename)){return "hub"}
      else {return "blade"}
    },
  },
  method : {
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
  
        let vec_p1top2 = model.method.vector.fromPoint(p1, p2);
        let vec_p3top4 = model.method.vector.fromPoint(p3, p4);
        let vec_p1top3 = model.method.vector.fromPoint(p1, p3);
  
        let d = model.method.vector.cross(vec_p1top2, vec_p3top4)[2];
        if(d==0){return {intersect: false ,u:null, v:null, point:null};} //parallel
  
        let u = model.method.vector.cross(vec_p1top3, vec_p3top4)[2]/d;
        let v = model.method.vector.cross(vec_p1top3, vec_p1top2)[2]/d;
  
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
  },
  get: {
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
      let res = model.method.intersection.polyline(bladeLine, shroudLine)
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
      const res = model.method.intersection.polyline(bladeLine, hubLine)
      const res2=[]
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
  },
  drawSVG:  {
    color: ["blue","maroon","green","purple","red","pink","aqua"],
    row: function(svg, blade){
      svg.polyline(blade.hub).fill("none")
      .attr("vector-effect", "non-scaling-stroke");

      svg.polyline(blade.shroud).fill("none")
      .attr("vector-effect", "non-scaling-stroke");

      svg.polyline(blade.le).fill("none")
      .attr("vector-effect", "non-scaling-stroke");

      svg.polyline(blade.te).fill("none")
      .attr("vector-effect", "non-scaling-stroke");

      svg.polyline(blade.in).fill("none")
      .attr("vector-effect", "non-scaling-stroke")
      .attr("stroke-dasharray","5 5");

      svg.polyline(blade.out).fill("none")
      .attr("vector-effect", "non-scaling-stroke")
      .attr("stroke-dasharray","5 5");
    },
    path: function(bladeRows){
      let svg =null
      if(model.sheetNumber ==0){
        svg = model.draw.screen.sheet[0]
        const color = this.color[0]
        svg.stroke({color:color, opacity:1.0, width:1})
        model.sheetNumber = 1 ;
      }
      else{
        svg = model.draw.screen.group()
        model.draw.screen.sheet.push(svg)
        model.sheetNumber = model.draw.screen.sheet.length-1 ;
        const color = this.color[model.sheetNumber % this.color.length]
        svg.stroke({color:color, opacity:1.0, width:1})
      }
       
      for(let blade in bladeRows){
        const eachBlade = bladeRows[blade];
        this.row(svg, eachBlade)
      }
    }
  }
}
