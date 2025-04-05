export interface Jugador {
    id: string,
    name: string,
    juega: boolean,
    tantos: number,
    puedeCantar: boolean,
    canto: string,
    mano: boolean,
    creditos: number,
    puedeFlor: boolean,
    valores: [{name: string, valor: number}]
}
