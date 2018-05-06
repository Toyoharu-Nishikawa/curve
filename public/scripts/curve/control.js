"use strict" 
import {view} from "./view.js"
import {model} from "./model.js"

export const control ={
  button:{
    import:{
      execute:function(e){
        model.button.import.execute(e)
      },
      add:function(){
        view.elements.import.onclick = this.execute
      },
    },
    export:{
      execute:function(){
        model.save.execute() 
      },
      add:function(){
        view.elements.export.onclick = this.execute
      },
    },
  },
  initialize: function(){
    const controls= [this.button]
    controls.forEach(control=>{
      for(let any in control){
        control[any].add()
      }
    })
  }
}
