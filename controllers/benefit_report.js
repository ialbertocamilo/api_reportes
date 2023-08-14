process.on('message', requestData => {
    generateReport(requestData)
})

const { con } = require('../db')
const { parseDateFromString,pluck,uniqueElements } = require("../helper/Helper");

const { worksheet, workbook, createAt, createHeaders } = require('../exceljs')
const { response } = require('../response')
const { Op } = require('sequelize');

const Benefit = require('../models/Benefit')
const Taxonomie = require('../models/Taxonomie');
const BenefitProperty = require('../models/BenefitProperty');
const Speaker = require('../models/Speaker');
const UserBenefit = require('../models/UserBenefit');
const { getSuboworkspacesIds } = require('../helper/Workspace')


// Headers for Excel file

const headers = [
    'Beneficio',
    'Tipo de Beneficio',
    'Estado',
    'Estado actual',
    'Inicio de Inscripción',
    'Cierre de Inscripción',
    'Confirmación',
    'Promotor',
    'Expositor',
    'Cupos',
    'Cantidad de segmentados',
    'Inscritos',
    '% de Inscritos (segmentación)',
    '% de Inscritos (cupos)',
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
    const taxo_user_status = await Taxonomie.findAll({
        where:{
            group:'benefit',
            type:'user_status',
            code: {
                [Op.in]: ['subscribed','approved']
            }
        }
    });
    const taxonomy_type_extraordinary = await Taxonomie.findOne({
        where:{
            group:'benefit',
            type:'type_register',
            code : 'extraordinario'
        }
    });
    const users_register_in_benefits = await UserBenefit.findAll({
        where: {
            benefit_id: {
                [Op.in]: benefit
            },
            status_id: {
                [Op.in]: pluck(taxo_user_status,'id')
            },
            deleted_at:null
        }
    })
    const modulos = await getSuboworkspacesIds(workspaceId);

    for (const benefit of benefits_list) {
        const cellRow = []
        const users_id_segmented = await Benefit.getUsersSegmentedInBenefit(modulos,benefit.id);
        const users_register_in_benefit = uniqueElements(users_register_in_benefits.filter(ur => ur.benefit_id == benefit.id), "user_id");
        const users_subscribed_extraordinary= users_register_in_benefit.filter(ur => ur.type_id == taxonomy_type_extraordinary.id);
        const users_registered_id = pluck(users_register_in_benefit,'user_id') ;
        const users_segmented_subscribed_id = users_id_segmented.filter((value) => users_registered_id.includes(value));
        let percent_subscribed_segmented = 0;
        let percent_subscribed_cupos= 0+'%';
        let cupos = benefit.cupos || 'Ilimitado';
        if(users_id_segmented.length>0 && users_segmented_subscribed_id.length>0){
            percent_subscribed_segmented = Math.floor(( users_segmented_subscribed_id.length / users_id_segmented.length) * 100);
        }
        if(cupos > 0 && users_segmented_subscribed_id.length>0){
            percent_subscribed_cupos = Math.floor(( users_segmented_subscribed_id.length / cupos) * 100) + '%';
        }
        if(cupos == 'Ilimitado' ){
            percent_subscribed_cupos = 'No aplica';   
        }
        cellRow.push(benefit.title)
        cellRow.push(benefit.type.name)
        cellRow.push(benefit.active ? 'Activo' : 'Inactivo')
        cellRow.push(benefit.status.name)
        cellRow.push(parseDateFromString(benefit.inicio_inscripcion))
        cellRow.push(parseDateFromString(benefit.fin_inscripcion))
        cellRow.push(parseDateFromString(benefit.fecha_liberacion))
        cellRow.push(benefit.promotor || 'No asignado')
        cellRow.push(benefit.speaker ? benefit.speaker.name : 'No asignado')
        cellRow.push(cupos)
        cellRow.push(users_id_segmented.length)
        cellRow.push(users_segmented_subscribed_id.length)
        cellRow.push( percent_subscribed_segmented +' %' )
        cellRow.push( percent_subscribed_cupos)
        cellRow.push(users_subscribed_extraordinary.length)
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
