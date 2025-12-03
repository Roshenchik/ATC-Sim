// Callsign.js
import { AIRLINES } from "./constants.js";
import { airlinePrefixes } from "./callsignAliases.js";

export class Callsign {
  constructor() {
    this.prefix = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
    this.number = (100 + Math.floor(Math.random() * 900)).toString();
    this.full = this.prefix + this.number;
    this.airline = airlinePrefixes[this.prefix] || this.prefix;
  }
}