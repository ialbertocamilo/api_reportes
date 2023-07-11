process.on('message', requestData => {
    generateReport(requestData)
})

const { con } = require('../db')
const moment = require('moment')
const { parseDateFromString } = require("../helper/Helper");

const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const { response } = require('../response')
const { Op } = require('sequelize');

const Benefit = require('../models/Benefit')
const Taxonomie = require('../models/Taxonomie');
const BenefitProperty = require('../models/BenefitProperty');
const Speaker = require('../models/Speaker');

// Headers for Excel file

const headers = [
    'Beneficio',
    'Tipo de Beneficio',
    'Estado',
    'Estado actual',
    'Inicio de Inscripción',
    'Fin de Inscripción',
    'Inicio',
    'Promotor',
    'Speaker',
    'Vacantes',
    'Cantidad de segmentados',
    'Inscritos',
    '% de Inscritos',
    'Valoración',
    'Inscripciones extraordinarias'
]

async function generateReport({
    workspaceId, benefit
}) {

    await createHeaders(headers)
    // Load users from database and generate ids array
    const benefits_list = await Benefit.findAll({
        where: {
            workspace_id: workspaceId,
            id: {
                [Op.in]: benefit
            }
        },
        include: [
            { model: Taxonomie, as: 'status' },
            { model: Taxonomie, as: 'type' },
            { model: Speaker, as: 'speaker' },
            { model: BenefitProperty,as:'properties'},
        ]
    });

    for (const benefit of benefits_list) {
        const cellRow = []
        console.log(benefit.speaker);
        cellRow.push(benefit.title)
        cellRow.push(benefit.type.name)
        cellRow.push(benefit.active ? 'Activo' : 'Inactivo')
        cellRow.push(benefit.status.name)
        cellRow.push(parseDateFromString(benefit.inicio_inscripcion))
        cellRow.push(parseDateFromString(benefit.fin_inscripcion))
        cellRow.push(parseDateFromString(benefit.fecha_liberacion))
        cellRow.push(benefit.promotor || 'No configurado')
        cellRow.push(benefit.speaker ? benefit.speaker.name : 'No aplica')
        cellRow.push(benefit.cupos)
        cellRow.push('-')
        cellRow.push('-')
        cellRow.push('-')
        cellRow.push('-')
        cellRow.push('-')
        worksheet.addRow(cellRow).commit()
    }

    if (worksheet._rowZero > 1) {
        workbook.commit().then(() => {
            process.send(response({ createAt, modulo: 'Benefit_report' }))
        })
    } else {
        process.send({ alert: 'No se encontraron resultados' })
    }
}
