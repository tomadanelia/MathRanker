import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface GlickoPlayer {
  rating: number;
  rd: number;
  vol: number;
}
// score = 1 for a win, 0.5 for a draw, 0 for a loss.
export type GlickoMatch = [number, number, number];
@Injectable()
export class EloService{
    constructor(private readonly prismaService: PrismaService) {}
    calculateNewElo(oppElo:number,playerElo:number){
    
    }
    
}
