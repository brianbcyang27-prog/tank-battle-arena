// Lightweight EventBus for decoupled UI/game communication
class EventBus {
    constructor() {
        this._handlers = {};
    }

    on(event, fn) {
        (this._handlers[event] ??= []).push(fn);
        return () => this.off(event, fn);
    }

    off(event, fn) {
        const handlers = this._handlers[event];
        if (handlers) {
            this._handlers[event] = handlers.filter(h => h !== fn);
        }
    }

    emit(event, data) {
        const handlers = this._handlers[event];
        if (handlers) {
            for (const fn of handlers) {
                try { fn(data); } catch (e) { console.error('[EventBus] handler error:', e); }
            }
        }
    }

    once(event, fn) {
        const wrapper = (data) => {
            fn(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    // Remove all listeners for an event
    clear(event) {
        if (event) {
            delete this._handlers[event];
        } else {
            this._handlers = {};
        }
    }
}

export const bus = new EventBus();

// Events used across the codebase:
//   navigation:showSettings, navigation:closeSettings, navigation:openPauseSettings
//   navigation:showAbout, navigation:closeAbout
//   navigation:showStats, navigation:closeStats
//   navigation:showLeaderboard, navigation:closeLeaderboard
//   navigation:showMissions, navigation:closeMissions
//   navigation:showProgression, navigation:closeProgression
//   navigation:showSeasonPass, navigation:closeSeasonPass
//   navigation:showShop, navigation:closeShop
//   navigation:showFriends, navigation:closeFriends
//   navigation:showUpgrades, navigation:closeUpgrades
//   navigation:showLoadout, navigation:closeLoadout
//   navigation:showTutorial, navigation:closeTutorial
//   settings:tabChanged
//   game:started, game:over, game:paused, game:resumed
//   progression:updated
