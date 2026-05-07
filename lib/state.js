const states = new Map();

/**
 * State Structure:
 * {
 *   url: string,
 *   title: string,
 *   thumbnail: string,
 *   duration: string,
 *   step: 'waiting_for_type' | 'waiting_for_quality',
 *   type: 'mp3' | 'mp4'
 * }
 */

const setState = (userId, state) => {
    states.set(userId, state);
};

const getState = (userId) => {
    return states.get(userId);
};

const deleteState = (userId) => {
    states.delete(userId);
};

module.exports = {
    setState,
    getState,
    deleteState
};
