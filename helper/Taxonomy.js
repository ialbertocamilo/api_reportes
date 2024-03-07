const { con } = require('../db');
exports.getPlatformId = async (platform)=>{
    const platform_code = platform=='induccion' ? 'employee_onboarding' : 'employee';
    const query_platform = `select id from taxonomies t where t.group ='user' and t.type  = 'type' and code ='${platform_code}';`
    const [_platform] = await con.raw(query_platform);
    console.log(_platform,'_platform',platform);
    return _platform[0].id;
}