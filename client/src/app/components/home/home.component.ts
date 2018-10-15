import { Component, OnInit } from '@angular/core';


@Component({
    selector: 'home',
    templateUrl: './home.component.html'
})

export class HomeComponent implements OnInit {
    public title:string;

    constructor(){
        this.title = "The Mike Nieva Community"
    }


    ngOnInit(){
        console.log('El componente de la home se ha cargado')
    }
}