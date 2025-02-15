const { con } = require("../db")
const moment = require("moment/moment")
const { pluck, logtime, setCustomIndexAtObject } = require('./Helper')
const { loadCriterionValuesByUser } = require('./Criterian')
const { getPlatformId } = require('./Taxonomy')


exports.getUsers = async (modulesIds, activeUsers, inactiveUsers) => {
  logtime("method: getUsers");
  if (modulesIds && activeUsers && inactiveUsers) {
    return con("users").whereIn("subworkspace_id", modulesIds);
  } else if (modulesIds && activeUsers && !inactiveUsers) {
    return con("users")
      .whereIn("subworkspace_id", modulesIds)
      .andWhere("active", 1);
  } else if (modulesIds && !activeUsers && inactiveUsers) {
    return con("users")
      .whereIn("subworkspace_id", modulesIds)
      .andWhere("active", 0);
  } else if (modulesIds && !activeUsers && !inactiveUsers) {
    return [];
  } else if (!modulesIds) {
    return [];
  }
};

const innerCriterionValueUser = (careers, areas, queryCondition) => {
  let query = `, group_concat( 
                distinct(cvu.criterion_value_id) separator ', ') as 
                stack_ids_cvu
                
            from users u 
            inner join criterion_value_user cvu on cvu.user_id = u.id `
            // inner join criterion_values cv on cvu.criterion_value_id = cv.id `

  query += queryCondition
  const MergeCareersAreas = [...careers, ...areas];
    
  query += ` and ( cvu.criterion_value_id in ( `;
  MergeCareersAreas.forEach(cv => query += `${cv},`);
  query = query.slice(0, -1);
  query += ` ) ) `;

  return query;
}

const havingProccessValueUser = (careers, areas) => {
  const CountCareers = careers.length;
  const CountAreas = areas.length;

  let stackCareer = [];
  
  for (let i = 0; i < CountCareers; i++) {
    const career_v = careers[i];

    if(CountAreas) {
      let stackArea = []
      for (let x = 0; x < CountAreas; x++) {
        const area_v = areas[x];
        stackArea.push(`'${career_v}, ${area_v}'`);
      }
      stackCareer.push(stackArea);
    } else stackCareer.push(`'${career_v}'`);

  }

  return ` having stack_ids_cvu in (${stackCareer.join(', ')}) `;
} 

exports.havingProccessValueUser = havingProccessValueUser;
exports.innerCriterionValueUser = innerCriterionValueUser;

exports.getUsersCareersAreas = async ( modulesIds, activeUsers, inactiveUsers,
                                       careers, areas,platform,

                                       colsquery = 'u.*',
                                       colsrelations = '',
                                       colsconditions = '' ) => {
  let query = ` select ${colsquery} `;
  const userCondition = ` ${colsrelations} 
                          where u.subworkspace_id in (${modulesIds.join()}) 
                          ${colsconditions} `; 

  const stateCareerArea = (careers.length > 0 || areas.length > 0); 
  if(stateCareerArea) query += innerCriterionValueUser(careers, areas, userCondition);
  else query += ` from users u ${userCondition} `;

  if (modulesIds && activeUsers && !inactiveUsers) {
    query += ` and u.active = 1`;
  } 
  if (modulesIds && !activeUsers && inactiveUsers) {
    query += ` and u.active = 0`;
  }
  const platform_id = await getPlatformId(platform);
  if(platform_id){
    query += ` and u.type_id=${platform_id} `;
  }
  query += ` and u.deleted_at is null `;

  query += ` group by u.id`;
  
  console.log(query,'query');
  const stateHavingCareerArea = (careers.length > 0 && areas.length > 0)
  if(stateHavingCareerArea) query += havingProccessValueUser(careers, areas);  

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
}

exports.addActiveUsersCondition = (query, activeUsers, inactiveUsers, inValues = false) => {
  if (activeUsers && inactiveUsers) {
    return  inValues ? `${query} and u.active in (1, 0)` : query; 
  } else if (activeUsers && !inactiveUsers) {
    return `${query} and u.active = 1`;
  } else if (!activeUsers && inactiveUsers) {
    return `${query} and u.active = 0`;
  }
};

/**
 * Load users criteria values from selected values
 * @param modules
 * @param userIds
 * @returns {Promise<*>}
 */

exports.loadUsersCriteriaValues = async (modules, userIds = null) => {
  logtime("method: loadUsersCriteriaValues");
  let query = `
    select 
        cvu.user_id, 
        cv.criterion_id,
        c.name criterion_name,
        group_concat(distinct cv.value_text separator ', ') value_text,
        if (c.code = 'cycle', 1, 0) is_cycle,
        cv.value_datetime,
        cv.value_date,
        cv.value_boolean,
        cv.value_decimal,
        cv.value_integer
    from
        users u
            inner join criterion_value_user cvu on cvu.user_id = u.id
            inner join criterion_values cv on cv.id = cvu.criterion_value_id
            inner join criteria c on c.id = cv.criterion_id
            inner join criterion_workspace cw on c.id = cw.criterion_id
    where
        cw.available_in_reports = 1
    `;

  // When module ids array has been provided, add condition to filter them

  if (modules) {
    if (modules.length > 0) {
      query += ` and u.subworkspace_id in (${modules.join()})`;
    }
  }

  // When user ids array has been provided, add condition to filter them

  if (userIds) {
    if (userIds.length > 0) {
      query += ` and u.id in (${userIds.join()})`;
    }
  }

  // Add sorting order

  query += '' +
    'group by u.id,cv.criterion_id ' +
    'order by c.position'
  // logtime(query);
  const [rows] = await con.raw(query)
  return rows
}

/**
 * Extract user criterion values according a list of criterion names,
 * if a value for criterion name is not found, add an empty value
 * @param userId
 * @param criterionNames
 * @param usersCriterionValues
 * @returns {*[]}
 */
exports.getUserCriterionValues = (
  userId,
  criterionNames,
  usersCriterionValues
) => {
  const result = [];
  const found = [];

  // Iterate criterion names to find its values
  const userValues = usersCriterionValues.filter(
    (ucv) => ucv.user_id === userId
  );
  // let userValuesCriteriosWithCiclos = userValues.filter(ucv => ucv.criterion_name === 'Ciclo');
  // userValues = userValues.filter(ucv => ucv.criterion_name != 'Ciclo');

  // if(userValuesCriteriosWithCiclos.length >0){
  //   const ciclos_name = pluck(userValuesCriteriosWithCiclos,'value_text').join(", ")
  //   userValuesCriteriosWithCiclos[0].value_text = ciclos_name
  //   userValues.push(userValuesCriteriosWithCiclos[0])
  // }
  criterionNames.forEach((name) => {
    userValues.forEach((userCriterionValue) => {
      if (userCriterionValue.criterion_name === name) {
        // Get criterion value

        let value = userCriterionValue.value_text
        if (userCriterionValue.is_cycle == 1) {
          if (value.includes(',')) {
            // Takes the last cycle
            const cycles = value.split(',')
            value = value.split(',')[cycles.length - 1]
          }
        }
        //if (userCriterionValue.value_datetime) value = moment(userCriterionValue.value_datetime).format('DD/MM/YYYY H:mm:ss')
        // if (userCriterionValue.value_date) value = moment(userCriterionValue.value_date).format('DD/MM/YYYY')
        // if (userCriterionValue.value_boolean === 1) value = 'Sí'
        // if (userCriterionValue.value_boolean === 0 && value === '-') value = 'No'
        // if (userCriterionValue.value_decimal !== null) value = userCriterionValue.value_decimal
        // if (userCriterionValue.value_integer !== null) value = userCriterionValue.value_integer

        // Since value for name was found, added to found array

        found.push(name);

        // Add name and value for results collection

        result.push({
          criterion_name: name,
          criterion_value: value,
        });
      }
    });

    // When value for name was not found, add an empty value

    if (!found.includes(name)) {
      result.push({
        criterion_name: name,
        criterion_value: null,
      });
    }
  });

  return result;
};

exports.getUserCriterionValues2 = async (userId, criterionNames, criteriaIds = []) => {

  const result = [];
  const found = [];

  const userValues = await loadCriterionValuesByUser(userId, criteriaIds);

  criterionNames.forEach((name) => {
    userValues.forEach((userCriterionValue) => {

      if (userCriterionValue.criterion_name === name) {

        // Get criterion value

        let value;
        if (userCriterionValue.value_text)
          value = userCriterionValue.value_text;

        // Since value for name was found, added to found array

        found.push(name);

        // Add name and value for results collection

        result.push({
          criterion_name: name,
          criterion_value: value,
        });
      }
    });

    // When value for name was not found, add an empty value

    if (!found.includes(name)) {
      result.push({
        criterion_name: name,
        criterion_value: null,
      });
    }
  });

  return result;
};



/**
 * Find user using its document number
 * @param document
 * @returns {Promise<ResolveResult<TResult>[0]>}
 */
exports.findUserByDocument = async (document) => {
  return await con("users")
    .select("*")
    .where("document", `${document}`)
    .then(([row]) => row);
};

/**
 * Load users which have all the provided criterion values ids
 *
 * @param workspaceId
 * @param criterionValuesIds
 * @returns {Promise<*[]>}
 */
exports.loadUsersIdsWithCriterionValues = async (
  workspaceId,
  criterionValuesIds
) => {
  criterionValuesIds = criterionValuesIds.filter((i) => !!i);
  if (criterionValuesIds.length === 0) return [];

  const [users] = await con.raw(
    `
    select 
        u.id,
        count(cvu.criterion_value_id) criterion_count
    from users u
        inner join criterion_value_user cvu on u.id = cvu.user_id
        inner join workspaces w on u.subworkspace_id = w.id
    where
        w.parent_id = :workspaceId and
        cvu.criterion_value_id in (${criterionValuesIds.join()}) 
    group by u.id
    having criterion_count = :criterionCount
  `,
    { workspaceId, criterionCount: criterionValuesIds.length }
  );

  return pluck(users, "id");
};

exports.getUsersNullAndNotNull = (users) => {

  let users_null = [],
      users_not_null = [];

  for (const user of users) {
    const { sc_created_at } = user;
      
    if (sc_created_at == null) users_null.push(user)
    else users_not_null.push(user);
  }   

  return { users_null, users_not_null }; 
}
exports.loadUsersBySubWorspaceIds = async (
  subWorkspaceIds, indexId = false) => {

 const [users] = await con.raw(

  ` 
    select
      u.subworkspace_id,
      u.id, u.name, u.phone_number,
      u.lastname, u.surname, u.email,
      u.document, u.active, u.last_login
    from users u where
      u.subworkspace_id IN (${subWorkspaceIds.join()})
`);

return indexId ? setCustomIndexAtObject(users) : users;

};

exports.subworkspacesUsersids = async (subWorkspaceIds) => {
  const [users] = await con.raw(

    ` 
    select
      *
    from users u where
      u.subworkspace_id IN (${subWorkspaceIds.join()})
`);

  return pluck(users, 'id');
}

/**
 * Check whether user is super administrador or not
 *
 * @param adminId
 * @returns {Promise<boolean>}
 */
exports.isSuper = async (adminId) => {

  if (!adminId) return false

  const [user] = await con.raw(`
    select
      *
    from users u 
        join assigned_roles ar on u.id = ar.entity_id
    
    where
      u.id = ${adminId}
      and ar.role_id = 1
      and ar.entity_type = "App\\\\Models\\\\User"
`);

  return !!user.length
}
