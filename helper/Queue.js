const { extension } = require('../config')
const GeneratedReport = require('../models/GeneratedReport')
const axios = require('axios')

/**
 * Check if reports in queue exists or not
 */
exports.isServerAvailable = async (workspaceId, adminId) => {
  const pendingReports = await GeneratedReport.findAll({
    where: {
      workspace_id: workspaceId,
      is_ready: false
    }
  })

  return pendingReports.length === 0
}

/**
 * Register report in queue
 */
exports.registerInQueue = async (
  reportType, reportName, workspaceId, adminId, filters, filtersDescriptions
) => {
  try {
    // Check if there is other pending report of the same type and
    // the same filters
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
        is_ready: false
      })
    }
  } catch (ex) {
    console.log(ex)
  }
}

/**
 * Update report status to ready
 */
exports.markReportAsReady = async (reportType, downloadPath, workspaceId, adminId, filters) => {
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
    reports[0].download_url = downloadPath
    await reports[0].save()
  }
}

exports.startNextReport = async (report, baseUrl) => {

  const filters = JSON.parse(report.filters)
  filters.skipQueue = 1

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

/**
 * Find next pending report and mark it as processing
 * @returns {Promise<null>}
 */
exports.findNextPendingReport = async () => {
  const reports = await GeneratedReport.findAll({
    order: [
      ['id', 'asc']
    ],
    where: {
      is_ready: false,
      is_processing: false
    }
  })

  if (reports[0]) {
    reports[0].is_processing = true
    await reports[0].save()
    return reports[0]
  } else {
    return null
  }
}

exports.generateReportPath = (createAt) => {
  return 'reports/' + createAt + extension
}
