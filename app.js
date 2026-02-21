// ============================================
// Supabase Configuration
// ============================================
const SUPABASE_URL = 'https://tnpuapxogjjwmjwmmsju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucHVhcHhvZ2pqd21qd21tc2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTkwNzksImV4cCI6MjA4NzIzNTA3OX0.XkeQfrTwpmhE9rRP-vRr2ydpQ-nQnvHrsDOVgOaoTXk';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Task Management Functions
// ============================================

// Fetch all tasks from Supabase
async function fetchTasks() {
    try {
        const { data: tasks, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderTasks(tasks);
    } catch (error) {
        showError('Failed to load tasks: ' + error.message);
        console.error('Error fetching tasks:', error);
    }
}

// Add a new task
async function addTask() {
    const input = document.getElementById('taskInput');
    const taskText = input.value.trim();

    if (!taskText) {
        input.focus();
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('tasks')
            .insert([
                { 
                    title: taskText, 
                    status: 'pending',
                    created_at: new Date().toISOString()
                }
            ]);

        if (error) throw error;

        input.value = '';
        input.focus();
        // Tasks will auto-update via Realtime subscription
    } catch (error) {
        showError('Failed to add task: ' + error.message);
        console.error('Error adding task:', error);
    }
}

// Complete a task
async function completeTask(id) {
    try {
        const { error } = await supabaseClient
            .from('tasks')
            .update({ 
                status: 'done',
                completed_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;
        // Tasks will auto-update via Realtime subscription
    } catch (error) {
        showError('Failed to complete task: ' + error.message);
        console.error('Error completing task:', error);
    }
}

// ============================================
// UI Rendering Functions
// ============================================

function renderTasks(tasks) {
    const availableContainer = document.getElementById('availableTasks');
    const completedContainer = document.getElementById('completedTasks');
    const availableCount = document.getElementById('availableCount');
    const completedCount = document.getElementById('completedCount');

    const availableTasks = tasks.filter(t => t.status !== 'done');
    const completedTasks = tasks.filter(t => t.status === 'done');

    // Update counts
    availableCount.textContent = availableTasks.length;
    completedCount.textContent = completedTasks.length;

    // Render available tasks
    if (availableTasks.length === 0) {
        availableContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <p>All caught up! No chores pending.</p>
            </div>
        `;
    } else {
        availableContainer.innerHTML = availableTasks.map(task => `
            <div class="task-item">
                <button class="complete-btn" onclick="completeTask('${task.id}')" title="Mark as complete"></button>
                <span class="task-text">${escapeHtml(task.title)}</span>
            </div>
        `).join('');
    }

    // Render completed tasks
    if (completedTasks.length === 0) {
        completedContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💪</div>
                <p>No completed chores yet. Get to work, hero!</p>
            </div>
        `;
    } else {
        completedContainer.innerHTML = completedTasks.map(task => `
            <div class="task-item completed">
                <button class="complete-btn" title="Completed"></button>
                <span class="task-text">${escapeHtml(task.title)}</span>
            </div>
        `).join('');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.innerHTML = `<div class="error">${message}</div>`;
    setTimeout(() => {
        errorDiv.innerHTML = '';
    }, 5000);
}

// ============================================
// Event Listeners
// ============================================

// Allow Enter key to add tasks
document.addEventListener('DOMContentLoaded', () => {
    const taskInput = document.getElementById('taskInput');
    
    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTask();
            }
        });
    }

    // Initialize app
    fetchTasks();
    setupRealtimeSubscription();
});

// ============================================
// Supabase Realtime Subscription
// ============================================

function setupRealtimeSubscription() {
    supabaseClient
        .channel('tasks-channel')
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                schema: 'public',
                table: 'tasks'
            },
            (payload) => {
                console.log('Realtime update received:', payload);
                // Refresh the task list when any change occurs
                fetchTasks();
            }
        )
        .subscribe((status) => {
            console.log('Realtime subscription status:', status);
        });
}
