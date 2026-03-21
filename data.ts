/**
 * Central data source for the app.
 * Reads from admin store (which persists to localStorage).
 * Changes made in the admin dashboard are reflected here.
 */
import { adminStore } from './admin/store';

export const getUsers = () => adminStore.getUsers();
export const getBadges = () => adminStore.getBadges();
export const getTokenPackages = () => adminStore.getTokenPackages();
export const getGifts = () => adminStore.getGifts();
export const getMonetizationSettings = () => adminStore.getMonetizationSettings();
export const getExploreCarousel = () => adminStore.getExploreCarousel();
