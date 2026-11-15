// Who may do what in the Coordination area.
// - Super admins and admins with "coordinationManage" see every file, create files and choose members.
// - Other admins need the "coordination" permission and see only the files they are a member of.
// - A member's role on a file sets what they can do there:
//     viewer       read, download, comment
//     editor       + edit the weekly records
//     coordinator  + submit a week and sign as Subject Coordinator
//     sectionHead  + approve a week and sign as Section Head (SH)
const isManager = (admin) => admin?.role === "super_admin" || (admin?.permissions || []).includes("coordinationManage");
const canUseArea = (admin) => isManager(admin) || (admin?.permissions || []).includes("coordination");

function roleIn(file, admin) {
    if (!file || !admin) return null;
    const member = (file.members || []).find((m) => String(m.admin?._id || m.admin) === String(admin._id));
    if (member) return member.role;
    return isManager(admin) ? "manager" : null;
}

function capsFor(role, admin) {
    const manager = isManager(admin);
    const has = (...roles) => roles.includes(role);
    return {
        view: Boolean(role),
        comment: Boolean(role),
        edit: manager || has("editor", "coordinator", "sectionHead"),
        signCoordinator: has("coordinator"),
        signSectionHead: has("sectionHead"),
        reopen: manager || has("coordinator", "sectionHead"),
        manage: manager,
        deleteWeek: manager || has("coordinator"),
    };
}

module.exports = { isManager, canUseArea, roleIn, capsFor };
