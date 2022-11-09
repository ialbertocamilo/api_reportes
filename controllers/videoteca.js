'use strict'
process.on('message', (requestData) => {
  exportarVideoteca(requestData)
});

require('../error');
const moment = require('moment');
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { response } = require('../response');

/* helpers */
const { getSuboworkspacesIds } = require('../helper/Workspace');
const { logtime } = require('../helper/Helper');
const { getCriterianUserByCode } = require('../helper/Criterian');

/* models */
const UserAction = require('../models/UserAction');
const User = require('../models/User');
const Videoteca = require('../models/Videoteca');
const CriterionValueUser = require('../models/CriterionValueUser');
const Workspace = require('../models/Workspace');

const defaultHeaders = [
  'MÓDULO',
  'GRUPO',
  'DNI, APELLIDOS Y NOMBRES, GENERO',
  'CARRERA',
  'VIDEOTECA',
  'VISITAS',
  'ÚLTIMA VISITA'
];

async function exportarVideoteca ({ workspaceId }) {

  /* BOTICA ONLY FOR FP */
  if(workspaceId === 25) {
    const anotherHeaders = [ 'MÓDULO','GRUPO', 'BOTICA',
                             'DNI, APELLIDOS Y NOMBRES, GENERO',
                             'CARRERA', 'VIDEOTECA', 'VISITAS', 'ÚLTIMA VISITA'];
    await createHeaders(anotherHeaders);
  } else await createHeaders(defaultHeaders);

  // data users by workspace
  const users = await UserAction.findAll({
      include:[ { 
                  model: User, 
                  include:[ { model: Workspace } ] 
                },
                { model: Videoteca,
                  where: { workspace_id: workspaceId } } ]
  });

  logtime('Start file generation')
  let test_array = [];

  for (const row of users) {
    
    const cellRow = [];

    // parse and set data
    const { updated_at, user, videoteca } = row;
    const lastVisit = moment(updated_at).format('DD/MM/YYYY H:mm:ss');

    const partName = `${user.document}, ${user.surname} ${user.lastname} ${user.name}`;
    const { workspace } = user;


    // get data by user id
    const gender = await getCriterianUserByCode(user.id, 'gender') ?? 'SIN GENERO';
    const grupo = await getCriterianUserByCode(user.id, 'grupo') ?? 'SIN GRUPO';
    const career = await getCriterianUserByCode(user.id, 'career') ?? 'SIN CARRERA';

    cellRow.push(workspace.name); //modulo
    cellRow.push(grupo); //grupo

    /* BOTICA ONLY FOR FP */
    if(workspaceId === 25) {
      const botica = await getCriterianUserByCode(user.id, 'botica') ?? 'SIN BOTICA';
      cellRow.push(botica); //botica
    }

    cellRow.push(`${partName}, ${gender}`); // documento, apellidos y nombres, genero
    cellRow.push(career); // carrera
    cellRow.push(videoteca.title); // videoteca.title
    cellRow.push(row.score); // visitas
    cellRow.push(lastVisit); // ultima visita

    worksheet.addRow(cellRow).commit()
  }
  logtime('End file generation')

  // Generate Excel file

  if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Videoteca' }));
      //process.send({ alert: 'Results funded', test_array, workspaceId });
    });
  } else {
    process.send({ alert: 'No se encontraron resultados' });
  }
}

/*
    const result = { modulo: workspace.name,
                     usuario: ,
                     videoteca: videoteca.title,
                     visitas: row.score,
                     ultima_visita: lastVisit, 
                     test: { gender, grupo, career } }; */
    