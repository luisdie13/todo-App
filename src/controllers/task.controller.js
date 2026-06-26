const Task = require('../models/task.model');
const Organization = require('../models/organization.model');
const Membership = require('../models/membership.model');
const Project = require('../models/project.model');
const auditLogService = require('../services/auditLog.service');

// ── Helper: Normalizador de tareas ──────────────────────────────────────────
const normalizeTask = (task) => ({
  _id: task._id,
  id: task._id,
  title: task.title,
  description: task.description,
  sensitive: !!task.sensitive,
  completed: !!task.completed,
  userId: task.userId,
  assignee: task.assignee,
  assigneeId: task.assignee?._id || task.assignee || null,
  projectId: task.projectId,
  status: task.status || 'backlog',
  priority: task.priority || 'medium',
  dueDate: task.dueDate || null,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt
});

// ── Controllers ─────────────────────────────────────────────────────────────

const getProjectTasks = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const currentUserId = req.user?.id || req.user?._id;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const isMember = await Membership.exists({ userId: currentUserId, projectId }) || 
                     req.user?.role === 'super_admin';
    if (!isMember && String(project.ownerId) !== String(currentUserId)) {
      return res.status(403).json({ error: 'Access Denied.' });
    }

    const tasks = await Task.find({ projectId }).populate('userId assignee', 'email name').lean();
    return res.status(200).json({ tasks: tasks.map(normalizeTask) });
  } catch (err) { next(err); }
};

const createProjectTask = async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId).trim();
    const project = await Project.findById(projectId);
    if (!project || project.status === 'archived') return res.status(403).json({ error: 'Project locked.' });

    const task = new Task({ ...req.body, projectId, userId: req.user?.id || req.user?._id });
    await task.save();
    await task.populate(['userId', 'assignee'], 'name email');
    return res.status(201).json({ task: normalizeTask(task) });
  } catch (err) { next(err); }
};

const updateProjectTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId).populate('userId assignee', 'name email');
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    
    Object.assign(task, req.body);
    await task.save();
    return res.status(200).json({ task: normalizeTask(task) });
  } catch (err) { next(err); }
};

const deleteProjectTask = async (req, res, next) => {
  try {
    await Task.findByIdAndDelete(req.params.taskId);
    return res.status(200).json({ message: 'Task deleted successfully.' });
  } catch (err) { next(err); }
};

const markTaskDone = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    task.completed = true;
    task.status = 'done';
    await task.save();
    return res.status(200).json({ task: normalizeTask(task) });
  } catch (err) { next(err); }
};

const getTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({ userId: req.user?.id || req.user?._id }).lean();
    return res.status(200).json(tasks.map(normalizeTask));
  } catch (err) { next(err); }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).json({ success: true, task: normalizeTask(task) });
  } catch (err) { next(err); }
};

const deleteTask = async (req, res, next) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true });
  } catch (err) { next(err); }
};

module.exports = {
  getProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  markTaskDone,
  getTasks,
  updateTask,
  deleteTask
};