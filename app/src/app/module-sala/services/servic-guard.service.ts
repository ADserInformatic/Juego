import { EventEmitter, Injectable, OnInit, Output } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ServicGuardService implements OnInit{
  @Output() verGuard: EventEmitter<boolean> = new EventEmitter()
  guardian!: boolean;

  constructor() { }
  ngOnInit(): void {
    this.verGuard.subscribe(res=>{
      this.guardian = res
      console.log(res)
    })
  }

  guard(): boolean{
    console.log(this.guardian)
    return this.guardian;
  }
}
