// ============================================
// Supabase Configuration
// ============================================
const SUPABASE_URL = 'https://tnpuapxogjjwmjwmmsju.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucHVhcHhvZ2pqd21qd21tc2p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTkwNzksImV4cCI6MjA4NzIzNTA3OX0.XkeQfrTwpmhE9rRP-vRr2ydpQ-nQnvHrsDOVgOaoTXk';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Auth State Management
// ============================================
let currentUser = null;
let selectedProfile = null;
let currentRole = null; // 'parent' or 'child'
let userPoints = 0;
let currentTab = 'tasks';

// Check auth state on load
async function checkAuthState() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session?.user) {
        currentUser = session.user;
        showMainContent();
    } else {
        showAuthSection();
        loadProfiles();
    }
}

// Show auth section, hide main content
function showAuthSection() {
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('realtimeIndicator').style.display = 'none';
}

// Show main content, hide auth section
async function showMainContent() {
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('realtimeIndicator').style.display = 'flex';
    
    // Fetch user's role and points from profiles table
    await fetchUserRole();
    
    // Display user's name
    const displayName = currentUser?.user_metadata?.display_name || 
                       currentUser?.email?.replace('@family.com', '');
    document.getElementById('userDisplayName').textContent = `Hello, ${displayName}!`;
    
    // Update UI based on role
    updateUIForRole();
    
    // Initialize app
    fetchTasks();
    setupRealtimeSubscription();
}

// Fetch user role and points from profiles table
async function fetchUserRole() {
    if (!currentUser) return;
    
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('role, total_points')
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            console.error('Error fetching user profile:', error);
            currentRole = null;
            userPoints = 0;
            return;
        }
        
        currentRole = profile?.role || null;
        userPoints = profile?.total_points || 0;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        currentRole = null;
        userPoints = 0;
    }
}

// Update UI elements based on user role
function updateUIForRole() {
    const addTaskSection = document.querySelector('.add-task-section');
    const pointsBadge = document.getElementById('userPoints');
    const pendingTab = document.getElementById('pendingTab');
    
    if (currentRole === 'child') {
        // Hide add task section for children
        if (addTaskSection) {
            addTaskSection.style.display = 'none';
        }
        // Show points for children
        if (pointsBadge) {
            pointsBadge.textContent = `⭐ ${userPoints} points`;
            pointsBadge.style.display = 'inline-block';
        }
        // Hide pending tab for children
        if (pendingTab) {
            pendingTab.style.display = 'none';
        }
    } else if (currentRole === 'parent') {
        // Show add task section for parents
        if (addTaskSection) {
            addTaskSection.style.display = 'block';
        }
        // Hide points for parents
        if (pointsBadge) {
            pointsBadge.style.display = 'none';
        }
        // Show pending tab for parents
        if (pendingTab) {
            pendingTab.style.display = 'block';
        }
    }
}

// ============================================
// Tab Navigation
// ============================================

function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    // Hide all tab content
    document.getElementById('tasksSection').style.display = 'none';
    document.getElementById('shopSection').style.display = 'none';
    document.getElementById('pendingSection').style.display = 'none';
    
    // Show selected tab content
    document.getElementById(`${tabName}Section`).style.display = 'block';
    
    // Load tab-specific data
    if (tabName === 'shop') {
        loadRewards();
    } else if (tabName === 'pending') {
        loadPendingRedemptions();
    }
}

// ============================================
// UUID Generator for ASCII-safe emails
// ============================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateEmail() {
    return `${generateUUID()}@family.com`;
}

// ============================================
// Profile Selection (Netflix-style)
// ============================================

// Fetch all profiles from the profiles table
async function loadProfiles() {
    try {
        const { data: profiles, error } = await supabaseClient
            .from('profiles')
            .select('display_name, email')
            .order('display_name', { ascending: true });

        if (error) throw error;

        renderProfiles(profiles || []);
    } catch (error) {
        console.error('Error loading profiles:', error);
        renderProfiles([]);
    }
}

// Render profiles as clickable cards
function renderProfiles(profiles) {
    const container = document.getElementById('profilesList');
    
    if (profiles.length === 0) {
        container.innerHTML = `
            <div class="empty-profiles">
                <p>No heroes yet. Be the first!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = profiles.map(profile => `
        <div class="profile-card" onclick="selectProfile('${escapeHtml(profile.display_name)}', '${escapeHtml(profile.email)}')" role="button" tabindex="0" aria-label="选择用户 ${escapeHtml(profile.display_name)}">
            <div class="profile-avatar">
                ${getInitials(profile.display_name)}
            </div>
            <span class="profile-name">${escapeHtml(profile.display_name)}</span>
        </div>
    `).join('');
}

// Get initials for avatar
function getInitials(name) {
    if (!name) return '?';
    
    const hasCJK = /[\u4e00-\u9fa5]/.test(name);
    
    if (hasCJK || name.length <= 2) {
        return name.slice(0, 2);
    }
    
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Select a profile and show password prompt
function selectProfile(displayName, email) {
    selectedProfile = { displayName, email };
    document.getElementById('selectedProfileName').textContent = displayName;
    
    document.getElementById('profileSelection').style.display = 'none';
    document.getElementById('passwordPrompt').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    
    setTimeout(() => {
        document.getElementById('loginPassword').focus();
    }, 100);
}

// Back to profile selection
function backToProfiles(event) {
    if (event) event.preventDefault();
    
    selectedProfile = null;
    
    document.getElementById('loginPassword').value = '';
    document.getElementById('signupDisplayName').value = '';
    document.getElementById('signupPassword').value = '';
    
    document.getElementById('profileSelection').style.display = 'flex';
    document.getElementById('passwordPrompt').style.display = 'none';
    document.getElementById('signupForm').style.display = 'none';
    
    loadProfiles();
}

// Show signup form
function showSignupForm() {
    document.getElementById('profileSelection').style.display = 'none';
    document.getElementById('passwordPrompt').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    
    setTimeout(() => {
        document.getElementById('signupDisplayName').focus();
    }, 100);
}

// ============================================
// Authentication Functions
// ============================================

async function handleProfileLogin() {
    const password = document.getElementById('loginPassword').value;
    
    if (!password) {
        showError('Please enter your password');
        return;
    }
    
    if (!selectedProfile || !selectedProfile.email) {
        showError('No profile selected');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: selectedProfile.email,
            password
        });
        
        if (error) throw error;
        
        currentUser = data.user;
        showMainContent();
        
        document.getElementById('loginPassword').value = '';
        selectedProfile = null;
    } catch (error) {
        showError('Login failed: ' + error.message);
        console.error('Login error:', error);
    }
}

async function handleSignup() {
    const displayName = document.getElementById('signupDisplayName').value.trim();
    const password = document.getElementById('signupPassword').value;
    
    if (!displayName || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }
    
    const email = generateEmail();
    
    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName
                }
            }
        });
        
        if (error) throw error;
        
        if (data.user) {
            const { error: profileError } = await supabaseClient
                .from('profiles')
                .update({ email: email })
                .eq('id', data.user.id);
            
            if (profileError) {
                console.error('Error updating profile email:', profileError);
            }
        }
        
        if (data.session) {
            currentUser = data.user;
            showMainContent();
        } else {
            showError('Account created successfully!');
            await loadProfiles();
            backToProfiles();
        }
        
        document.getElementById('signupDisplayName').value = '';
        document.getElementById('signupPassword').value = '';
    } catch (error) {
        showError('Sign up failed: ' + error.message);
        console.error('Sign up error:', error);
    }
}

async function handleLogout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        selectedProfile = null;
        currentRole = null;
        userPoints = 0;
        currentTab = 'tasks';
        showAuthSection();
        loadProfiles();
    } catch (error) {
        showError('Logout failed: ' + error.message);
        console.error('Logout error:', error);
    }
}

// ============================================
// Task Management Functions
// ============================================

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

async function addTask() {
    if (currentRole !== 'parent') {
        showError('Only parents can add new chores!');
        return;
    }
    
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
    } catch (error) {
        showError('Failed to add task: ' + error.message);
        console.error('Error adding task:', error);
    }
}

// Complete a task and award 10 points
async function completeTask(id) {
    try {
        // Update task status
        const { error: taskError } = await supabaseClient
            .from('tasks')
            .update({ 
                status: 'done',
                completed_at: new Date().toISOString()
            })
            .eq('id', id);

        if (taskError) throw taskError;
        
        // Award 10 points to the user who completed the task
        if (currentUser) {
            // Fetch current points
            const { data: profile, error: fetchError } = await supabaseClient
                .from('profiles')
                .select('total_points')
                .eq('id', currentUser.id)
                .single();
            
            if (fetchError) {
                console.error('Error fetching current points:', fetchError);
            } else {
                const currentPoints = profile?.total_points || 0;
                const newPoints = currentPoints + 10;
                
                // Update points
                const { error: pointsError } = await supabaseClient
                    .from('profiles')
                    .update({ total_points: newPoints })
                    .eq('id', currentUser.id);
                
                if (pointsError) {
                    console.error('Error updating points:', pointsError);
                } else {
                    // Update local state
                    userPoints = newPoints;
                    
                    // Update UI if child (show points badge)
                    if (currentRole === 'child') {
                        const pointsBadge = document.getElementById('userPoints');
                        if (pointsBadge) {
                            pointsBadge.textContent = `⭐ ${userPoints} points`;
                        }
                    }
                    
                    showSuccess('Task completed! +10 points earned!');
                }
            }
        }
    } catch (error) {
        showError('Failed to complete task: ' + error.message);
        console.error('Error completing task:', error);
    }
}

function renderTasks(tasks) {
    const availableContainer = document.getElementById('availableTasks');
    const completedContainer = document.getElementById('completedTasks');
    const availableCount = document.getElementById('availableCount');
    const completedCount = document.getElementById('completedCount');

    const availableTasks = tasks.filter(t => t.status !== 'done');
    const completedTasks = tasks.filter(t => t.status === 'done');

    availableCount.textContent = availableTasks.length;
    completedCount.textContent = completedTasks.length;

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
                <button class="complete-btn" onclick="completeTask('${task.id}')" title="Mark as complete" aria-label="完成任务: ${escapeHtml(task.title)}"></button>
                <span class="task-text">${escapeHtml(task.title)}</span>
            </div>
        `).join('');
    }

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
                <button class="complete-btn" title="Completed" aria-label="已完成: ${escapeHtml(task.title)}" disabled></button>
                <span class="task-text">${escapeHtml(task.title)}</span>
            </div>
        `).join('');
    }
}

// ============================================
// Reward Shop Functions
// ============================================

async function loadRewards() {
    try {
        const { data: rewards, error } = await supabaseClient
            .from('rewards')
            .select('*')
            .order('cost', { ascending: true });

        if (error) throw error;

        renderRewards(rewards || []);
    } catch (error) {
        showError('Failed to load rewards: ' + error.message);
        console.error('Error fetching rewards:', error);
    }
}

function renderRewards(rewards) {
    const container = document.getElementById('rewardsGrid');
    
    if (rewards.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="background: rgba(255,255,255,0.1); border-radius: 16px; backdrop-filter: blur(10px);">
                <div class="empty-state-icon">🎁</div>
                <p>No rewards available yet. Check back later!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = rewards.map(reward => {
        const canAfford = userPoints >= reward.cost;
        return `
            <div class="reward-card">
                <div class="reward-icon">${escapeHtml(reward.icon || '🎁')}</div>
                <div class="reward-title">${escapeHtml(reward.title)}</div>
                <div class="reward-cost">${reward.cost} points</div>
                <button 
                    class="buy-btn ${!canAfford ? 'insufficient' : ''}" 
                    onclick="buyReward('${reward.id}', ${reward.cost})"
                    ${!canAfford ? 'disabled' : ''}
                >
                    ${canAfford ? 'Buy' : 'Not enough points'}
                </button>
            </div>
        `;
    }).join('');
}

async function buyReward(rewardId, cost) {
    if (currentRole !== 'child') {
        showError('Only children can buy rewards!');
        return;
    }
    
    if (userPoints < cost) {
        showError('Not enough points!');
        return;
    }
    
    try {
        // Subtract points from user's profile
        const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ total_points: userPoints - cost })
            .eq('id', currentUser.id);
        
        if (updateError) throw updateError;
        
        // Add record to redemptions table
        const { error: redemptionError } = await supabaseClient
            .from('redemptions')
            .insert([
                {
                    child_id: currentUser.id,
                    reward_id: rewardId,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }
            ]);
        
        if (redemptionError) throw redemptionError;
        
        // Update local points
        userPoints -= cost;
        
        // Update UI
        document.getElementById('userPoints').textContent = `⭐ ${userPoints} points`;
        loadRewards(); // Refresh to update button states
        
        showSuccess('Goal Reached! Ask Dad for your reward.');
    } catch (error) {
        showError('Failed to buy reward: ' + error.message);
        console.error('Error buying reward:', error);
    }
}

// ============================================
// Pending Redemptions Functions (Parent View)
// ============================================

async function loadPendingRedemptions() {
    if (currentRole !== 'parent') return;
    
    try {
        const { data: redemptions, error } = await supabaseClient
            .from('redemptions')
            .select(`
                id,
                created_at,
                rewards (title, icon),
                profiles (display_name)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderPendingRedemptions(redemptions || []);
    } catch (error) {
        showError('Failed to load pending redemptions: ' + error.message);
        console.error('Error fetching pending redemptions:', error);
    }
}

function renderPendingRedemptions(redemptions) {
    const container = document.getElementById('pendingRedemptions');
    
    if (redemptions.length === 0) {
        container.innerHTML = `
            <div class="empty-pending">
                <div class="empty-pending-icon">🎉</div>
                <p>No pending redemptions!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = redemptions.map(redemption => {
        const date = new Date(redemption.created_at).toLocaleDateString();
        return `
            <div class="pending-item">
                <div class="pending-icon">${escapeHtml(redemption.rewards?.icon || '🎁')}</div>
                <div class="pending-info">
                    <div class="pending-reward-title">${escapeHtml(redemption.rewards?.title || 'Unknown Reward')}</div>
                    <div class="pending-child-name">Requested by: ${escapeHtml(redemption.profiles?.display_name || 'Unknown')}</div>
                    <div class="pending-date">${date}</div>
                </div>
                <button class="approve-btn" onclick="approveRedemption('${redemption.id}')">
                    Approve
                </button>
            </div>
        `;
    }).join('');
}

async function approveRedemption(redemptionId) {
    if (currentRole !== 'parent') {
        showError('Only parents can approve redemptions!');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('redemptions')
            .update({ 
                status: 'approved',
                approved_at: new Date().toISOString(),
                approved_by: currentUser.id
            })
            .eq('id', redemptionId);
        
        if (error) throw error;
        
        showSuccess('Redemption approved!');
        loadPendingRedemptions(); // Refresh the list
    } catch (error) {
        showError('Failed to approve redemption: ' + error.message);
        console.error('Error approving redemption:', error);
    }
}

// ============================================
// UI Helper Functions
// ============================================

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

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.innerHTML = `<div class="success">${message}</div>`;
    setTimeout(() => {
        successDiv.innerHTML = '';
    }, 5000);
}

// ============================================
// Event Listeners
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    checkAuthState();
    
    const taskInput = document.getElementById('taskInput');
    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTask();
            }
        });
    }
    
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleProfileLogin();
            }
        });
    }
    
    const signupPassword = document.getElementById('signupPassword');
    if (signupPassword) {
        signupPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSignup();
            }
        });
    }
    
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            currentUser = session.user;
            showMainContent();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            showAuthSection();
            loadProfiles();
        }
    });
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
                event: '*',
                schema: 'public',
                table: 'tasks'
            },
            (payload) => {
                console.log('Realtime update received:', payload);
                if (currentTab === 'tasks') {
                    fetchTasks();
                }
            }
        )
        .subscribe((status) => {
            console.log('Realtime subscription status:', status);
        });
}

// ============================================
// Service Worker Registration (PWA)
// ============================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
    });
}
