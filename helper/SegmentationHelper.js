const moment = require("moment");
const { con } = require("../db");
const { loadTopicsByCourseId, getCourseStatusId } = require("./CoursesTopicsHelper");
const {
  groupArrayOfObjects,
  groupArrayOfObjects_v2,
  uniqueElements,
  pluckUnique,
  logtime,
  pluck,
} = require("./Helper");

const StackBuildQuery = {
  // sides: relacion ('inner','left','right','cross')
  // num: nro de tablas
  setCustomSideJoin(sides, num) { 
    const bySides = sides.split(',');
    const countBySides = bySides.length;

    if(countBySides > num) return console.error('error:sides es mayor a num'); //error
    if(countBySides === num) return bySides;

    // rellenamos hasta que iguale a num 
    const diffSides = (num - countBySides);
    const lastValue = bySides[countBySides - 1];

    for (let i = 0; i < diffSides; i++) {
      bySides.push(lastValue)
    }

    return bySides;
  },

};

exports.loadUsersSegmented = async (course_id) => {
  // select `id` from `users`
  // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?)
  // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?)
  // where `active` = ?
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });
    const [rows] =
      await con.raw(`select users.id , users.name,users.lastname,users.surname,users.email, users.document ,sc.grade_average,sc.advanced_percentage,sc.status_id,sc.created_at as sc_created_at from users
        LEFT OUTER join summary_courses sc on sc.user_id = users.id and sc.course_id = ${course_id}
        ${join_criterions_values_user} 
        where users.active=1 
        and users.deleted_at is null`);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return uniqueElements(users, "id");
};

exports.loadUsersSegmentedv2 = async (
  course_id,
  modules = [],
  areas = [],

  start_date = null,
  end_date = null,

  activeUsers = false,
  inactiveUsers = false,

  completed
) => {
  const segments_groupby = await getCurrentSegmentsByCourseId(course_id);
  let users = [];

  // === para 'completed' es boolean
  const StackSidesCompleted = completed ? 'left' : 'inner'; 
  const [ first ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 1);
  // === para 'completed' es boolean

  for (let segment of segments_groupby) {
    const join_criterions_values_user = getInnerCriteriosAtSegment(segment);

    // === filtro para fecha ===
    // const queryJoin = start_date || end_date ? `INNER` : `LEFT OUTER`;
    const start_date_query = start_date
      ? ` and date(sc.updated_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(sc.updated_at) <= '${end_date}'`
      : ``;
    // === filtro para fecha ===

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    // === filtro para usuarios ===
    let where_active_users = '';
    if(activeUsers && !inactiveUsers) where_active_users += ` and u.active = 1`;
    if(!activeUsers && inactiveUsers) where_active_users += ` and u.active = 0`;
    // === filtro para usuarios ===

    // === filtro para areas ===
    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
        join_criterions_values_user_area += ` 
          inner join criterion_value_user cvu 
            on cvu.user_id = u.id
          inner join criterion_values cv 
            on cvu.criterion_value_id = cv.id `;
    
        where_criterions_values_user_area += ` 
          and cvu.criterion_value_id in ( ${areas.join()} )`
    }
    // === filtro para areas ===
    
    let query = `
        select 
          u.id,
          sc.grade_average, sc.advanced_percentage,
          sc.status_id, sc.created_at as sc_created_at,
          sc.views as course_views, sc.passed as course_passed, 
          sc.assigned, sc.completed,
          sc.last_time_evaluated_at, sc.restarts,
          sc.taken, sc.reviewed, sc.assigned,
          sc.status_id as course_status_id

        from users u
        
          ${first} join summary_courses sc 
            on sc.user_id = u.id 
            and sc.course_id = ${course_id} 
          ${join_criterions_values_user} 

          ${join_criterions_values_user_area}

        where 
          u.deleted_at is null
          ${where_active_users}
          ${modules_query} 

          ${where_criterions_values_user_area}

          ${start_date_query} ${end_date_query}
          `
    // logtime(query);
    const [rows] = await con.raw(query);

    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }

  return uniqueElements(users, "id");
};

exports.loadUsersSegmentedv2WithSummaryTopics = async (
  course_id,
  modules = [],
  areas = [],
  temas = [],

  start_date = null,
  end_date = null,
  
  activeUsers = false,
  inactiveUsers = false,

  activeTopics = false,
  inactiveTopics = false,

  completed
) => {
  const segments_groupby = await getCurrentSegmentsByCourseId(course_id);
  let users = [];

  // === para 'completed' es boolean
  const StackSidesCompleted = completed ? 'left,inner,inner,left': 'inner'; 
  const [ first, second, 
          third, fourth ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
  // === para 'completed' es boolean

  for (let segment of segments_groupby) {
    const join_criterions_values_user = getInnerCriteriosAtSegment(segment);

    // === filtro para fecha ===
    // const queryJoin = start_date || end_date ? `inner` : `left`;
    const start_date_query = start_date
      ? ` and date(st.updated_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(st.updated_at) <= '${end_date}'`
      : ``;
    // === filtro para fecha ===

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    // === filtro para usuarios ===
    let where_active_users = '';
    if(activeUsers && !inactiveUsers) where_active_users += ` and u.active = 1`;
    if(!activeUsers && inactiveUsers) where_active_users += ` and u.active = 0`;
    // === filtro para usuarios ===

    // === filtro para areas ===
    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
        join_criterions_values_user_area += ` 
          inner join criterion_value_user cvu 
            on cvu.user_id = u.id
          inner join criterion_values cv 
            on cvu.criterion_value_id = cv.id `;
    
        where_criterions_values_user_area += ` 
          and cvu.criterion_value_id in ( ${areas.join()} )`
    }
    // === filtro para areas ===

    // === filtro para topics ===
    let where_in_topics = (temas.length) ? ` and t.id in(${temas.join()}) `: ``;
    let where_active_topics = '';
    if(activeTopics && !inactiveTopics) where_active_topics += `and t.active = 1`; 
    if(!activeTopics && inactiveTopics) where_active_topics += `and t.active = 0`; 
    // === filtro para topics ===

    let query = `
        select 
          u.id,
          t.id topic_id,

          sc.status_id as course_status_id,
          sc.restarts course_restarts,
          sc.created_at sc_created_at, 

          st.grade topic_grade,
          st.attempts topic_attempts,
          st.restarts topic_restarts,
          st.views topic_views,
          st.status_id topic_status_id,
          st.last_time_evaluated_at topic_last_time_evaluated_at,
          json_extract(c.mod_evaluaciones, '$.nota_aprobatoria') minimum_grade

        from users u
        
          ${first} join summary_courses sc 
            on sc.user_id = u.id and sc.course_id = ${course_id}
          ${second} join courses c 
            on c.id = ${course_id}
          ${third} join topics t 
            on t.course_id = c.id
          ${fourth} join summary_topics st 
            on st.topic_id = t.id and st.user_id = u.id
          ${join_criterions_values_user} 
          ${join_criterions_values_user_area}

        where 
          u.deleted_at is null
          ${where_active_users}
          
          ${modules_query}
          ${where_criterions_values_user_area}
          
          ${where_in_topics}
          ${where_active_topics}
          
          ${start_date_query} ${end_date_query}
    `;  

    // logtime(query);
    const [ rows ] = await con.raw(query);

    if (rows.length > 0) {
      if (users.length) {
        // funcion de MergeArrayByObjects
        users = mergeArraysObjectGroupedKeys({current: rows, compared: users});
      } else users = rows;
    }

  }

  return users;
};

exports.loadUsersSegmentedv2WithSummaryTopicsNoEva = async (
  course_id,
  modules = [],
  areas = [],
  temas = [],

  start_date = null,
  end_date = null,
  
  activeUsers = false,
  inactiveUsers = false,

  activeTopics = false,
  inactiveTopics = false,

  completed
) => {
 const segments_groupby = await getCurrentSegmentsByCourseId(course_id);
  let users = [];

  // === para 'completed' es boolean
  const StackSidesCompleted = completed ? 'left,inner,inner,left': 'inner'; 
  const [ first, second, 
          third, fourth ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
  // === para 'completed' es boolean

  for (let segment of segments_groupby) {
    const join_criterions_values_user = getInnerCriteriosAtSegment(segment);

    // === filtro para fecha ===
    // const queryJoin = start_date || end_date ? `inner` : `left`;
    const start_date_query = start_date
      ? ` and date(st.updated_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(st.updated_at) <= '${end_date}'`
      : ``;
    // === filtro para fecha ===

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    // === filtro para usuarios ===
    let where_active_users = '';
    if(activeUsers && !inactiveUsers) where_active_users += ` and u.active = 1`;
    if(!activeUsers && inactiveUsers) where_active_users += ` and u.active = 0`;
    // === filtro para usuarios ===

    // === filtro para areas ===
    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
        join_criterions_values_user_area += ` 
          inner join criterion_value_user cvu 
            on cvu.user_id = u.id
          inner join criterion_values cv 
            on cvu.criterion_value_id = cv.id `;
    
        where_criterions_values_user_area += ` 
          and cvu.criterion_value_id in ( ${areas.join()} )`
    }
    // === filtro para areas ===

    // === filtro para topics ===
    let where_in_topics = (temas.length) ? ` and t.id in(${temas.join()}) `: ``;
    let where_active_topics = '';
    if(activeTopics && !inactiveTopics) where_active_topics += `and t.active = 1`; 
    if(!activeTopics && inactiveTopics) where_active_topics += `and t.active = 0`; 
    // === filtro para topics ===

    let query = `
        select 
          u.id,
          t.id topic_id,

          sc.created_at as sc_created_at,

          st.grade topic_grade,
          st.views topic_views,
          st.status_id topic_status_id

        from users u
          
          ${first} join summary_courses sc 
            on sc.user_id = u.id 
            and sc.course_id = ${course_id}
          ${second} join courses c 
            on c.id = ${course_id}
          ${third} join topics t 
            on t.course_id = c.id
          ${fourth} join summary_topics st 
            on st.topic_id = t.id and st.user_id = u.id

          ${join_criterions_values_user} 
          ${join_criterions_values_user_area}

        where 
          u.deleted_at is null
          and t.assessable = 0 
          ${where_active_users}
          
          ${modules_query}
          ${where_criterions_values_user_area}
          
          ${where_in_topics}
          ${where_active_topics}
          
          ${start_date_query} ${end_date_query}
    `;  

    // logtime(query);
    const [ rows ] = await con.raw(query);

    if (rows.length > 0) {

      if (users.length) {
        // funcion de MergeArrayByObjects
        users = mergeArraysObjectGroupedKeys({current: rows, compared: users});
      } else users = rows;
    }
  }

  return users;
};

exports.loadUsersSegmentedv2WithSummaryTopicsEva = async (
  course_id,
  modules = [],
  areas = [],
  temas = [],

  start_date = null,
  end_date = null,
  
  activeUsers = false,
  inactiveUsers = false,

  activeTopics = false,
  inactiveTopics = false,

  completed
) => {
  const segments_groupby = await getCurrentSegmentsByCourseId(course_id);
  let users = [];

  // === para 'completed' es boolean
  const StackSidesCompleted = completed ? 'left,inner,inner,left': 'inner'; 
  const [ first, second, 
          third, fourth ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
  // === para 'completed' es boolean

  for (let segment of segments_groupby) {
    const join_criterions_values_user = getInnerCriteriosAtSegment(segment);

    // === filtro para fecha ===
    // const queryJoin = start_date || end_date ? `inner` : `left`;
    const start_date_query = start_date
      ? ` and date(st.updated_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(st.updated_at) <= '${end_date}'`
      : ``;
    // === filtro para fecha ===

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    // === filtro para usuarios ===
    let where_active_users = '';
    if(activeUsers && !inactiveUsers) where_active_users += ` and u.active = 1`;
    if(!activeUsers && inactiveUsers) where_active_users += ` and u.active = 0`;
    // === filtro para usuarios ===

    // === filtro para areas ===
    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
        join_criterions_values_user_area += ` 
          inner join criterion_value_user cvu 
            on cvu.user_id = u.id
          inner join criterion_values cv 
            on cvu.criterion_value_id = cv.id `;
    
        where_criterions_values_user_area += ` 
          and cvu.criterion_value_id in ( ${areas.join()} )`
    }
    // === filtro para areas ===

    // === filtro para topics ===
    let where_in_topics = (temas.length) ? ` and t.id in(${temas.join()}) `: ``;
    let where_active_topics = '';
    if(activeTopics && !inactiveTopics) where_active_topics += `and t.active = 1`; 
    if(!activeTopics && inactiveTopics) where_active_topics += `and t.active = 0`; 
    // === filtro para topics ===

    let query = `
        select 
          u.id,
          t.id topic_id,
          st.answers,

          sc.created_at as sc_created_at,

          st.views topic_views,
          st.status_id topic_status_id

        from users u

          ${first} join summary_courses sc 
            on sc.user_id = u.id 
            and sc.course_id = ${course_id}
          ${second} join courses c 
            on c.id = ${course_id}
          ${third} join topics t 
            on t.course_id = c.id
          ${fourth} join summary_topics st 
            on st.topic_id = t.id and st.user_id = u.id
          
          ${join_criterions_values_user} 
          ${join_criterions_values_user_area}

        where 
          u.deleted_at is null 
          and t.assessable = 1
          ${where_active_users}
          
          ${modules_query}
          ${where_criterions_values_user_area}
          
          ${where_in_topics}
          ${where_active_topics}
          
          ${start_date_query} ${end_date_query}
    `;  

    // logtime(query);
    const [ rows ] = await con.raw(query);

    if (rows.length > 0) {

      if (users.length) {
        // funcion de MergeArrayByObjects
        users = mergeArraysObjectGroupedKeys({current: rows, compared: users});
      } else users = rows;
    }
  }
  // logtime(`FIN METHOD : [loadUsersSegmentedv2]`)
  return users;
};

function mergeArraysObjectGroupedKeys({ current, compared },
                                      currentKey = 'id',
                                      comparedKey = 'id') {

  const current_indexed = groupArrayOfObjects_v2(current, currentKey);
  const compared_indexed = groupArrayOfObjects_v2(compared, comparedKey);

  for(const value in current_indexed) {
    const currentVal = compared_indexed[value];
    if(!currentVal) compared.push(...current_indexed[value]);
  }

  return compared;
}

async function getCurrentSegmentsByCourseId(course_id) {
  // logtime(`[---Load user segmented : ${course_id}---]`);
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );

  return segments_groupby;
}

function getInnerCriteriosAtSegment(segment) {
  // logtime(`[---Load user criterios segment : ${segment}---]`);
  const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");

  let join_criterions_values_user = "";

  grouped.forEach((values, idx) => {
    if (values[0].code != "date") {
      const criterios_id = pluckUnique( values, "criterion_value_id"
      ).toString();
      join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
    } else {
      let select_date = "select id from criterion_values where ";
      values.forEach((value, index) => {
        const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
        const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
        select_date += ` ${index > 0 ? "or" : ""
          } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
          }`;
      });
      select_date += " and deleted_at is null";
      join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
    }
  });

  return join_criterions_values_user;
}

exports.loadUsersSegmentedv2CountCourses = async (
  course_id,
  modules = [],
  areas = [],

  start_date = null,
  end_date = null,

  activeUsers = false,
  inactiveUsers = false) => {
// logtime(`INICIO METHOD : [loadUsersSegmentedv2]`)
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];

  for (let segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id})`;
        // console.log('criterios_inner', join_criterions_values_user);
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });

    // USERS FILTERS
    const queryJoin = start_date || end_date ? `INNER` : `LEFT OUTER`;
    const start_date_query = start_date
      ? ` and date(sc.updated_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(sc.updated_at) <= '${end_date}'`
      : ``;

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    let where_active_users = '';
    if(activeUsers && !inactiveUsers) where_active_users += ` and u.active = 1`;
    if(!activeUsers && inactiveUsers) where_active_users += ` and u.active = 0`;
    
    // filtro para areas
    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
        join_criterions_values_user_area += ` 
          inner join criterion_value_user cvu 
            on cvu.user_id = u.id
          inner join criterion_values cv 
            on cvu.criterion_value_id = cv.id `;
    
        where_criterions_values_user_area += ` 
          and cvu.criterion_value_id in ( ${areas.join()} )`
    }

    let whereInUserIds = ''
    if (userIds.length) {
      whereInUserIds = ` and u.id in ( ${userIds.join(',')} )`
    }

    // filtro para areas
    
    let query = `
        select 
          u.id,
          sc.grade_average, sc.advanced_percentage,
          sc.status_id, sc.created_at as sc_created_at,
          sc.views as course_views, sc.passed as course_passed, 
          sc.assigned, sc.completed,
          sc.last_time_evaluated_at, sc.restarts,
          sc.taken, sc.reviewed,
          sc.status_id as course_status_id

        from users u
        
          ${queryJoin} join summary_courses sc 
            on sc.user_id = u.id and sc.course_id = ${course_id} 
          ${join_criterions_values_user} 

          ${join_criterions_values_user_area}

        where 
          u.deleted_at is null
          ${where_active_users}
          ${modules_query} 
          ${whereInUserIds}  
          ${where_criterions_values_user_area}

          ${start_date_query} ${end_date_query}
          `
    logtime(query);
    const [rows] = await con.raw(query);

    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return uniqueElements(users, "id");
}

exports.loadCourses = async (
  {
    cursos = [],
    escuelas = [],
    CursosActivos,
    CursosInactivos,

    tipocurso }, workspaceId) => {

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      c.active as course_active,
      tx.name as course_type

    from course_school as cs

      inner join courses as c 
        on c.id = cs.course_id
      inner join schools as s
        on s.id = cs.school_id
      inner join taxonomies as tx
        on tx.id = c.type_id 
      inner join school_workspace as sw
        on sw.school_id = s.id

    where  
      sw.workspace_id = ${workspaceId}  
      and c.deleted_at is null 
  `;

  // posible filtro en estado de curso
  if(CursosActivos && !CursosInactivos) query += ` and c.active = 1`;
  if(!CursosActivos && CursosInactivos) query += ` and c.active = 0`;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  if(!tipocurso) query += ` and not tx.code = 'free'`;
  
  query += ` group by cs.course_id`;

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};

exports.loadCoursesV2 = async (
{ escuelas = [],
  cursos = [],
  temas = [],

  CursosActivos,
  CursosInactivos,

  tipocurso }, 
  workspaceId,
  deleted_at = true) => {

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      c.active as course_active,
      tx.name as course_type

    from course_school as cs

      inner join courses as c 
        on c.id = cs.course_id
      inner join schools as s
        on s.id = cs.school_id
      inner join taxonomies as tx
        on tx.id = c.type_id 
      inner join school_workspace as sw
        on sw.school_id = s.id
      inner join topics as t
          on t.course_id = c.id
    
    where  
      sw.workspace_id = ${workspaceId}  
  `; 
  if(deleted_at) query += ` and c.deleted_at is null `; // mms para eliminado

  // posible filtro en estado de curso
  if(CursosActivos && !CursosInactivos) query += ` and c.active = 1`;
  if(!CursosActivos && CursosInactivos) query += ` and c.active = 0`;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  if(temas.length) query += ` and t.id in (${temas.join()})`;
  if(!tipocurso) query += ` and not tx.code = 'free'`;
  
  query += ` group by cs.course_id`;
  // logtime(query);
  const [rows] = await con.raw(query);
  return rows;
}

/**
 * Load module's courses according segmentation
 * @param moduleId
 * @returns {Promise<array>}
 */
exports.loadModuleCoursesIds = async (moduleId) => {
  const query = `
      select distinct model_id as course_id

      from segments s

      where s.model_type like '%Course'
        and active = 1
        and id in (
            select distinct segment_id
            from segments_values sv
            where criterion_id = 1 -- module criterion
                and criterion_value_id = :moduleId -- module
      )
  `
  const [rows] = await con.raw(query, { moduleId })

  return pluck(rows, 'course_id')
}
