const { extension } = require('../config')
const GeneratedReport = require('../models/GeneratedReport')

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
  reportType, workspaceId, adminId, selectedFilters
) => {
  try {
    // Check if there is other pending report of the same type and
    // the same filters

    const pendingReports = await GeneratedReport.findAll({
      where: {
        report_type: reportType,
        workspace_id: workspaceId,
        admin_id: adminId,
        filters: JSON.stringify(selectedFilters),
        is_ready: false
      }
    })

    // Register report in the queue only when there is
    // no other pending report of the same type and
    // the same filters

    if (pendingReports.length === 0) {
      await GeneratedReport.create({
        report_type: reportType,
        workspace_id: workspaceId,
        admin_id: adminId,
        filters: JSON.stringify(selectedFilters),
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
exports.markReportAsReady = async (reportType, downloadPath, workspaceId, adminId) => {
  await GeneratedReport.update(
    {
      is_ready: true,
      download_url: downloadPath
    },
    {
      where: {
        report_type: reportType,
        admin_id: adminId,
        workspace_id: workspaceId,
        is_ready: false
      }
    }
  )
}

// exports.verifyReportsStatus = ({ body, params }, res) => {
//   res.send(params.reportName)
// }

exports.generateReportPath = (createAt) => {
  return 'reports/' + createAt + extension
}
