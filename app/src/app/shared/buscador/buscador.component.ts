import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-buscador',
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.css']
})
export class BuscadorComponent implements OnInit {

  @Input() elementos!: Array<any>;
  @Output() id: EventEmitter<any> = new EventEmitter()
  @ViewChild('inp') input!: ElementRef;
  nuevoArray: Array<any> = []
  form!: FormGroup;
  @Input() textoInput: string = 'Buscar...'

  constructor(private fb: FormBuilder){}
  
  ngOnInit(): void {
    this.form = this.fb.group({
      texto: ''
    })

    this.form.valueChanges.subscribe(res=>{
      this.nuevoArray = this.elementos.filter(e => e.name.toUpperCase().includes(res.texto.toUpperCase()))
      if(res === ''){
        this.nuevoArray = []
      }
    })
    
  }

  verId(e:any){
    this.id.emit(e)
    this.input.nativeElement.value = e.name
    this.nuevoArray = []
  }
    

}
