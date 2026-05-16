import React, { useState, useEffect } from 'react';
import { plannerService, groupService, meetingService } from '../services/api';
import '../assets/styles/studyPlanner.css';

const StudyPlanner = () => {
    const [tasks, setTasks] = useState([]);
    const [goals, setGoals] = useState([]);
    const [groups, setGroups] = useState([]);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    
    // New Task State
    const [taskName, setTaskName] = useState('');
    const [taskDate, setTaskDate] = useState('');
    const [taskTime, setTaskTime] = useState('');
    const [category, setCategory] = useState('');
    const [priority, setPriority] = useState('');
    const [taskNote, setTaskNote] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('');

    // New Goal State
    const [goalInput, setGoalInput] = useState('');
    
    // Calendar marks
    const [calendarMarks, setCalendarMarks] = useState([]);
    const [calDate, setCalDate] = useState('');
    const [calNote, setCalNote] = useState('');

    const [user] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    useEffect(() => {
        fetchPlannerData();
        fetchGroups();
    }, []);

    const fetchPlannerData = async () => {
        try {
            const data = await plannerService.getPlanner();
            if (data?.data?.tasks) setTasks(data.data.tasks);
            else if (data?.tasks) setTasks(data.tasks);
            else if (Array.isArray(data?.data)) setTasks(data.data);
            else if (Array.isArray(data)) setTasks(data);
            
            if (data?.weeklyGoals) setGoals(data.weeklyGoals);
        } catch (err) {
            console.error('Failed to load planner data', err);
        }
    };

    const fetchGroups = async () => {
        try {
            const data = await groupService.getMyGroups();
            setGroups(data.data || []);
        } catch (err) {
            console.error('Failed to load groups', err);
        }
    };

    const handleAddTask = async (e) => {
        e.preventDefault();
        try {
            if (category === 'Meeting') {
                await meetingService.createMeeting({
                    title: taskName,
                    groupId: selectedGroup || null,
                    scheduledAt: `${taskDate}T${taskTime || '00:00'}:00`
                });
            } else {
                await plannerService.addTask({
                    title: taskName,
                    date: taskDate,
                    time: taskTime,
                    category,
                    priority,
                    note: taskNote,
                    groupId: selectedGroup || null
                });
            }
            fetchPlannerData();
            // Reset form
            setTaskName('');
            setTaskDate('');
            setTaskTime('');
            setCategory('');
            setPriority('');
            setTaskNote('');
            setSelectedGroup('');
        } catch (err) {
            console.error('Failed to add task', err);
        }
    };

    const toggleTask = async (id, isCompleted) => {
        try {
            await plannerService.updateTask(id, { completed: !isCompleted });
            fetchPlannerData();
        } catch (err) {
            console.error('Failed to update task', err);
        }
    };

    const deleteTask = async (id) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;
        try {
            await plannerService.deleteTask(id);
            fetchPlannerData();
        } catch (err) {
            console.error('Failed to delete task', err);
            alert(err || "Failed to delete task. You might not be authorized.");
        }
    };

    const handleAddGoal = () => {
        if (!goalInput.trim()) return;
        setGoals([...goals, { text: goalInput, done: false }]);
        setGoalInput('');
    };

    const handleMarkCalendar = () => {
        if (!calDate || !calNote) return;
        setCalendarMarks([...calendarMarks, { date: calDate, note: calNote }]);
        setCalDate('');
        setCalNote('');
    };

    const isTaskCompleted = (task) => {
        return task.completedBy?.includes(user?._id);
    };

    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title?.toLowerCase().includes(search.toLowerCase());
        let matchesFilter = true;
        if (filter !== 'all') {
            if (filter === 'completed') matchesFilter = isTaskCompleted(task);
            else matchesFilter = task.priority === filter || task.category === filter;
        }
        return matchesSearch && matchesFilter;
    });

    const goalsDone = goals.filter(g => g.done).length;
    const goalsTotal = goals.length;
    const goalPercent = goalsTotal > 0 ? (goalsDone / goalsTotal) * 100 : 0;

    const renderNote = (note) => {
        if (!note) return null;
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = note.split(urlRegex);
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                return <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
            }
            return part;
        });
    };

    return (
        <main className="planner-container">
            <h1 className="gradient-text">📅 Study Planner</h1>

            {/* STATS BAR */}
            <div className="stats-bar">
                <div className="stat-card">
                    <span className="stat-number">{tasks.length}</span>
                    <span className="stat-label">Total Tasks</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{tasks.filter(t => isTaskCompleted(t)).length}</span>
                    <span className="stat-label">Completed</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{tasks.filter(t => !isTaskCompleted(t)).length}</span>
                    <span className="stat-label">Pending</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{tasks.filter(t => t.category === 'Meeting').length}</span>
                    <span className="stat-label">Meetings</span>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="filter-bar">
                <button className={`filter-btn ${filter === 'all' ? 'active-filter' : ''}`} onClick={() => setFilter('all')}>All</button>
                <button className={`filter-btn ${filter === 'High' ? 'active-filter' : ''}`} onClick={() => setFilter('High')}>🔴 High</button>
                <button className={`filter-btn ${filter === 'Medium' ? 'active-filter' : ''}`} onClick={() => setFilter('Medium')}>🟠 Medium</button>
                <button className={`filter-btn ${filter === 'Low' ? 'active-filter' : ''}`} onClick={() => setFilter('Low')}>🟢 Low</button>
                <button className={`filter-btn ${filter === 'Meeting' ? 'active-filter' : ''}`} onClick={() => setFilter('Meeting')}>📹 Meetings</button>
                <button className={`filter-btn ${filter === 'completed' ? 'active-filter' : ''}`} onClick={() => setFilter('completed')}>✅ Completed</button>
                <input type="text" placeholder="🔍 Search tasks..." className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {/* TASK FORM */}
            <form id="taskForm" className="task-form" onSubmit={handleAddTask}>
                <input type="text" placeholder="📝 Enter Task" required value={taskName} onChange={e => setTaskName(e.target.value)} />
                <input type="date" required value={taskDate} onChange={e => setTaskDate(e.target.value)} />
                <input type="time" placeholder="Time" value={taskTime} onChange={e => setTaskTime(e.target.value)} />
                
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                    <option value="">Personal Task (No Group)</option>
                    {groups.map(g => (
                        <option key={g._id} value={g._id}>Group: {g.name}</option>
                    ))}
                </select>

                <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">Category</option>
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                    <option value="Literature">Literature</option>
                    <option value="DSA">DSA</option>
                    <option value="OS">OS</option>
                    <option value="DBMS">DBMS</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Other">Other</option>
                </select>

                <select value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="">Priority</option>
                    <option value="High">🔴 High</option>
                    <option value="Medium">🟠 Medium</option>
                    <option value="Low">🟢 Low</option>
                </select>
                
                <input type="text" placeholder="📌 Add note (optional)" value={taskNote} onChange={e => setTaskNote(e.target.value)} />
                <button type="submit">➕ Add Task</button>
            </form>

            {/* TASK LIST */}
            <div id="taskList" className="task-list">
                {filteredTasks.map(task => {
                    const completed = isTaskCompleted(task);
                    return (
                        <div key={task._id} className="task-item" style={{ opacity: completed ? 0.6 : 1 }}>
                            <div>
                                <h3>
                                    {task.title} {task.priority === 'High' ? '🔴' : task.priority === 'Medium' ? '🟠' : task.priority === 'Low' ? '🟢' : ''}
                                    {task.groupId && <span style={{fontSize:'12px', marginLeft:'10px', backgroundColor:'#f7a043', color:'white', padding:'2px 6px', borderRadius:'4px'}}>Group Task</span>}
                                </h3>
                                <p>{task.date && new Date(task.date).toLocaleDateString()} {task.time && `- ${task.time}`} | {task.category}</p>
                                {task.note && <p><em>Note: {renderNote(task.note)}</em></p>}
                            </div>
                            <div>
                                <button onClick={() => toggleTask(task._id, completed)}>{completed ? 'Undo' : 'Complete'}</button>
                                {task.user === user?._id && (
                                    <button onClick={() => deleteTask(task._id)} style={{marginLeft: '8px', backgroundColor: '#e74c3c'}}>Delete</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* MAIN FLEX LAYOUT */}
            <section className="main-flex-layout">

                {/* LEFT */}
                <div className="left-column">
                    <section className="weekly-goals">
                        <h2>🎯 Weekly Goals</h2>
                        <div className="goal-progress-wrapper">
                            <div className="goal-progress-bar">
                                <div className="goal-progress-fill" style={{width: `${goalPercent}%`}}></div>
                            </div>
                            <span style={{color:'white', fontSize:'12px'}}>{goalsDone}/{goalsTotal} done</span>
                        </div>
                        <ul id="goalList">
                            {goals.map((g, idx) => (
                                <li key={idx} style={{textDecoration: g.done ? 'line-through' : 'none'}}>
                                    {g.text}
                                </li>
                            ))}
                        </ul>
                        <div className="goal-input-row">
                            <input type="text" placeholder="Add Weekly Goal" value={goalInput} onChange={e => setGoalInput(e.target.value)} />
                            <button type="button" onClick={handleAddGoal}>➕</button>
                        </div>
                    </section>

                    <section className="calendar-section">
                        <h2>🗓️ Mark Study Dates</h2>
                        <input type="date" value={calDate} onChange={e => setCalDate(e.target.value)} />
                        <input type="text" placeholder="Note for this date" value={calNote} onChange={e => setCalNote(e.target.value)} />
                        <button type="button" onClick={handleMarkCalendar}>✔️ Mark</button>
                        <ul id="calendarList">
                            {calendarMarks.map((mark, idx) => (
                                <li key={idx}>{mark.date}: {mark.note}</li>
                            ))}
                        </ul>
                    </section>
                </div>

                {/* MIDDLE */}
                <div className="middle-column" style={{ flex: 2 }}>
                    <h2>📆 Google Calendar</h2>
                    <iframe
                        src="https://calendar.google.com/calendar/embed?src=en.indian%23holiday%40group.v.calendar.google.com&ctz=Asia%2FKolkata"
                        style={{border:0, width:"100%", height:"400px"}} allowFullScreen>
                    </iframe>
                </div>

            </section>
        </main>
    );
};

export default StudyPlanner;
