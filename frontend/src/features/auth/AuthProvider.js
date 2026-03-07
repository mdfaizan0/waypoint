"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import api, { setTokenGetter } from "@/lib/api";

const AuthContext = createContext({
    user: null,
    role: null,
    isLoading: true,
    refreshUser: () => Promise.resolve(),
});

export const AuthProvider = ({ children }) => {
    const { isLoaded: isClerkLoaded, isSignedIn, getToken } = useAuth();

    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const fetchingRef = useRef(false);

    useEffect(() => {
        setTokenGetter(getToken);
    }, [getToken]);

    const fetchUserProfile = useCallback(async () => {
        // Guard against concurrent/re-entrant calls
        if (fetchingRef.current) return;
        fetchingRef.current = true;

        try {
            // skipToast prevents error toasts from triggering re-renders
            // that would cause the effect to re-fire and loop infinitely
            const response = await api.get("/users/me", { skipToast: true });
            if (response.data.success) {
                const userData = response.data.user;
                setUser({
                    id: userData.id,
                    name: userData.name,
                    email: userData.email,
                    imageUrl: userData.imageUrl || null
                });
                setRole(userData.role);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            setUser(null);
            setRole(null);
        } finally {
            setIsLoading(false);
            fetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!isClerkLoaded) return;

        if (isSignedIn) {
            fetchUserProfile();
        } else {
            setUser(null);
            setRole(null);
            setIsLoading(false);
        }
    }, [isClerkLoaded, isSignedIn, fetchUserProfile]);

    const refreshUser = async () => {
        setIsLoading(true);
        await fetchUserProfile();
    };

    return (
        <AuthContext.Provider value={{ user, role, isLoading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => useContext(AuthContext);
