import { parseCSV } from './csv';

describe('parseCSV', () => {
  it('parse un CSV avec en-tête (séparateur ;)', () => {
    const rows = parseCSV('Nom;Prix\nVeste;15\nCasque;120');
    expect(rows).toEqual([
      { Nom: 'Veste', Prix: '15' },
      { Nom: 'Casque', Prix: '120' },
    ]);
  });

  it('gère les guillemets, le séparateur dans une cellule et le BOM', () => {
    const rows = parseCSV('﻿Nom;Prix\n"Veste; rouge";"1 200"');
    expect(rows[0].Nom).toBe('Veste; rouge');
    expect(rows[0].Prix).toBe('1 200');
  });

  it('détecte la virgule comme séparateur si pas de point-virgule', () => {
    const rows = parseCSV('a,b\n1,2');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('retourne [] si une seule ligne ou vide', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('Nom;Prix')).toEqual([]);
  });
});
