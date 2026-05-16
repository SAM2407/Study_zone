import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    const message = error.response?.data?.message || 'Something went wrong';
    return Promise.reject(message);
  }
);

export const authService = {
  login: (data) => api.post('/users/login', data),
  sendOTP: (data) => api.post('/users/send-otp', data),
  verifyOTP: (data) => api.post('/users/verify-otp', data),
  resendOTP: (data) => api.post('/users/resend-otp', data),
  forgotPassword: (data) => api.post('/users/forgot-password', data),
  resetPassword: (data) => api.post('/users/reset-password', data),
  getCurrentUser: () => api.get('/users/current'),
};

export const groupService = {
  getPublicGroups: () => api.get('/groups/public'),
  getMyGroups: () => api.get('/groups/my-groups'),
  joinGroup: (id) => api.post(`/groups/join/${id}`),
  leaveGroup: (id) => api.post(`/groups/leave/${id}`),
  createGroup: (data) => api.post('/groups/create', data),
  getMembers: (id) => api.get(`/groups/members/${id}`),
  kickMember: (groupId, memberId) => api.post(`/groups/kick/${groupId}/${memberId}`),
};

export const resourceService = {
  getGroupResources: (groupId) => api.get(`/resources${groupId && groupId !== 'public' ? `?groupId=${groupId}` : ''}`),
  uploadResource: (data) => api.post('/resources/upload', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteResource: (id) => api.delete(`/resources/${id}`),
};

export const plannerService = {
  getPlanner: () => api.get('/planner'),
  addTask: (data) => api.post('/planner/task', data),
  updateTask: (id, data) => api.put(`/planner/task/${id}`, data),
  deleteTask: (id) => api.delete(`/planner/task/${id}`),
};

export const meetingService = {
  createMeeting: (data) => api.post('/meetings/create', data),
  getMeetingDetails: (id) => api.get(`/meetings/${id}`),
  endMeeting: (id) => api.delete(`/meetings/end/${id}`),
};

export default api;
