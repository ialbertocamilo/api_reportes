const { extension } = require('../config')
const GeneratedReport = require('../models/GeneratedReport')
const axios = require('axios')
const { Op } = require('sequelize')
const moment = require('moment-timezone')

/**
 * Check if reports in queue exists or not
 */
exports.isServerAvailable = async (workspaceId, adminId) => {
  let pendingReports = []
  try {
    pendingReports = await GeneratedReport.findAll({
      where: {
        workspace_id: workspaceId,
        is_ready: false
      }
    })
  } catch (ex) {
    console.log(ex)
  }

  return pendingReports.length === 0
}

/**
 * Register report in queue
 */
exports.registerInQueue = async (
  reportType, reportName, workspaceId, adminId, filters, filtersDescriptions
) => {
  try {
    // Check if there is other pending report
    // of the same type and the same filters

    const pendingReports = await GeneratedReport.findAll({
      where: {
        report_type: reportType,
        workspace_id: workspaceId,
        admin_id: adminId,
        filters: JSON.stringify(filters),
        is_ready: false
      }
    })

    // Register report in the queue only when there is
    // no other pending report of the same type and
    // the same filters

    if (pendingReports.length === 0) {
      await GeneratedReport.create({
        report_type: reportType,
        name: reportName,
        workspace_id: workspaceId,
        admin_id: adminId,
        filters: JSON.stringify(filters),
        filters_descriptions: JSON.stringify(filtersDescriptions),
        is_ready: false,
        created_at: getCurrentStringDate()
      })
    }
  } catch (ex) {
    console.log(ex)
  }
}

/**
 * Update report status to ready
 */
exports.markReportAsReady = async (
  reportType, downloadPath, workspaceId, adminId, filters, failed = false
) => {
  const reports = await GeneratedReport.findAll({
    where: {
      report_type: reportType,
      admin_id: adminId,
      workspace_id: workspaceId,
      filters: JSON.stringify(filters),
      is_ready: false
    }
  })

  if (reports[0]) {
    reports[0].is_ready = 1
    reports[0].is_processing = 0
    reports[0].failed = failed ? 1 : 0
    reports[0].download_url = downloadPath
    reports[0].updated_at = getCurrentStringDate()
    await reports[0].save()
  }
}

/**
 * Perform a request to start a new report
 * @param report
 * @param baseUrl
 * @returns {Promise<void>}
 */
const startNextReport = async (report, baseUrl) => {

  const filters = JSON.parse(report.filters)

  // Adds skipQueue option, to avoid report to be
  // added to queue, since is already there

  filters.skipQueue = 1

  // Perform request

  try {
    await axios({
      url: baseUrl + '/exportar/' + report.report_type,
      method: 'post',
      data: filters
    })
  } catch (ex) {
    console.log(ex)
  }
}
exports.startNextReport = startNextReport

/**
 * Find next pending report and mark it as 'processing'
 * @returns {Promise<null>}
 */
const findNextPendingReport = async (workspaceId) => {
  const reports = await GeneratedReport.findAll({
    order: [
      ['id', 'asc']
    ],
    where: {
      workspace_id: workspaceId,
      is_ready: false,
      is_processing: false
    }
  })

  if (reports[0]) {
    // Update status of report to 'processing'

    reports[0].is_processing = true
    reports[0].updated_at = getCurrentStringDate()
    await reports[0].save()
    return reports[0]
  } else {
    return null
  }
}
exports.findNextPendingReport = findNextPendingReport

/**
 * Mark pracessing report as pending, and start queue again
 * @returns {Promise<boolean>}
 */
exports.restartQueueExecution = async (io, adminId, workspaceId, baseUrl) => {
  // Iterate every 'pending', if
  // processing, change its status to 'pending'

  const reports = await GeneratedReport.findAll({
    order: [['id', 'asc']],
    where: {
      workspace_id: workspaceId,
      is_ready: false
    }
  })

  for (let i = 0; i < reports.length; i++) {
    if (reports[i].is_processing) {
      reports[i].is_processing = false
      await reports[i].save()
    }
  }

  const pendingReport = await findNextPendingReport(workspaceId)
  if (pendingReport) {
    io.sockets.emit('report-started', {
      report: pendingReport,
      adminId: adminId
    })
    await startNextReport(pendingReport, baseUrl)
    return true
  } else {
    return false
  }
}

/**
 * Generate report's name and path
 * @param createAt
 * @returns {string}
 */
exports.generateReportPath = (createAt) => {
  return 'reports/' + createAt + extension
}

const getCurrentStringDate = () => {
  return moment(new Date()).tz('America/Lima').format('YYYY-MM-DD HH:mm:ss')
}

exports.getCurrentStringDate = getCurrentStringDate
