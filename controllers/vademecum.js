'use strict'
process.on('message', (requestData) => {
  exportarVademecum(requestData)
});

require('../error');
const moment = require('moment');
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs');
const { response } = require('../response');
const { Op } = require('sequelize');

/* helpers */
const { getSuboworkspacesIds } = require('../helper/Workspace');
const { logtime } = require('../helper/Helper');
const { getCriterianUserByCode } = require('../helper/Criterian');

/* models */
const UserAction = require('../models/UserAction');
const User = require('../models/User');
const Vademecum = require('../models/Vademecum');
const CriterionValueUser = require('../models/CriterionValueUser');
const Workspace = require('../models/Workspace');

const defaultHeaders = [
  'MÓDULO',
  'GRUPO - SISTEMA',
  'GRUPO',
  'DNI, APELLIDOS Y NOMBRES, GENERO',
  'CARRERA',
  'VADEMECUM',
  'VISITAS',
  'ÚLTIMA VISITA'
];

async function exportarVademecum ({ workspaceId, vademecumsSelected }) {

  /* BOTICA ONLY FOR FP */
  if(workspaceId === 25) {
    const anotherHeaders = [ 'MÓDULO','GRUPO - SISTEMA', 'GRUPO', 'BOTICA',
                             'DNI, APELLIDOS Y NOMBRES, GENERO',
                             'CARRERA', 'VADEMECUM', 'VISITAS', 'ÚLTIMA VISITA'];
    await createHeaders(anotherHeaders);
  } else await createHeaders(defaultHeaders);

  // data users by vademecums
  const users = await UserAction.findAll({
      where: {
        model_type: "App\\Models\\Vademecum"
      },
      include:[ { 
                  model: User, 
                  include:[ { model: Workspace } ] 
                },
                { model: Vademecum,
                  where: { 
                    id: { [Op.in] : vademecumsSelected }  
                  }
                } ]
  });
  logtime('Start file generation');

  for (const row of users) {
    
    const cellRow = [];

    // parse and set data
    const { updated_at, user, vademecum: _vademecum } = row;
    const lastVisit = moment(updated_at).format('DD/MM/YYYY H:mm:ss');

    const partName = `${user.document}, ${user.surname} ${user.lastname} ${user.name}`;
    const { workspace } = user;


    // get data by user id
    const gender = await getCriterianUserByCode(user.id, 'gender') || 'SIN GÉNERO';
    const grupo = await getCriterianUserByCode(user.id, 'grupo') || 'SIN GRUPO';
    const career = await getCriterianUserByCode(user.id, 'career') || 'SIN CARRERA';
    
    const partCreated = moment(updated_at).format('DDMMYYYY');
    const grupoSystem = `${workspace.codigo_matricula}-${partCreated}`;

    cellRow.push(workspace.name); //modulo
    cellRow.push(grupoSystem); //grupo - sistema
    cellRow.push(grupo); //grupo
    /* BOTICA ONLY FOR FP */
    if(workspaceId === 25) {
      const botica = await getCriterianUserByCode(user.id, 'botica') || 'SIN BOTICA';
      cellRow.push(botica); //botica
    }

    cellRow.push(`${partName}, ${gender}`); // documento, apellidos y nombres, genero
    cellRow.push(career); // carrera
    cellRow.push(_vademecum.name); // _vademecum.name
    cellRow.push(row.score); // visitas
    cellRow.push(lastVisit); // ultima visita

    worksheet.addRow(cellRow).commit()
  }
  logtime('End file generation')

  // Generate Excel file

 if (worksheet._rowZero > 1) {
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Vademecum' }));
    });
  } else {
    process.send({ alert: 'No se encontraron resultados' });
  }
}