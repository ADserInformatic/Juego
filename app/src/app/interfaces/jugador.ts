export interface Jugador {
    id: string,
    name: string,
    juega: boolean,
    tantos: number,
    puedeCantar: boolean,
    canto: string,
    creditos: number,
    valores: [{name: string, valor: number}]
}
