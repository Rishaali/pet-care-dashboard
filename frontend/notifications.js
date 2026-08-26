(function () {
    const bell = document.getElementById("notification-bell");
    const panel = document.getElementById("notification-panel");
    const badge = document.getElementById("notification-badge");
    const list = document.getElementById("notification-list");
    const empty = document.getElementById("notification-empty");
    const countText = document.getElementById("notification-count-text");
    const markRead = document.getElementById("btn-mark-notifications-read");

    if (!bell || !panel || !badge || !list || !empty || !countText || !markRead) {
        return;
    }

    let lastPetIds = [];

    function getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem("petziUser") || "null");
        } catch (error) {
            return null;
        }
    }

    function getAuthHeaders(extraHeaders = {}) {
        const token = localStorage.getItem("petziToken");
        return token ? { ...extraHeaders, Authorization: `Bearer ${token}` } : extraHeaders;
    }

    async function authFetch(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: getAuthHeaders(options.headers || {})
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("petziUser");
            localStorage.removeItem("petziToken");
            window.location.replace("auth.html?mode=login");
        }
        return response;
    }

    function uniq(values) {
        return [...new Set(values.filter(Boolean).map(String))];
    }

    async function getNotificationPets() {
        const mode = bell.dataset.notificationScope || "current";
        const currentUser = getCurrentUser();

        if (mode === "all" && currentUser && currentUser.id) {
            const response = await authFetch("/api/pets");
            if (!response.ok) throw new Error("Failed to load pets for notifications");
            const pets = await response.json();
            return pets.map(pet => ({
                id: String(pet.id),
                name: pet.name || "Pet"
            }));
        }

        const params = new URLSearchParams(window.location.search);
        const selector = document.getElementById("header-pet-selector");
        const petId = params.get("pet_id") || params.get("id") || (selector && selector.value);
        return petId ? [{ id: String(petId), name: "" }] : [];
    }

    async function syncNotifications(petId) {
        await authFetch("/api/notifications/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pet_id: petId })
        });
    }

    async function getUnreadNotifications(pet) {
        const response = await authFetch(`/api/notifications/unread/${pet.id}`);
        if (!response.ok) throw new Error("Failed to load unread notifications");
        const notifications = await response.json();
        return Array.isArray(notifications)
            ? notifications.map(item => ({ ...item, pet_name: pet.name }))
            : [];
    }

    function formatNotificationTime(value) {
        if (!value) return "";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function setCount(total) {
        badge.textContent = total > 99 ? "99+" : String(total);
        badge.classList.toggle("hidden", total === 0);
        countText.textContent = total === 0
            ? "No unread notifications"
            : `${total} unread notification${total === 1 ? "" : "s"}`;
    }

    function renderNotifications(notifications) {
        list.innerHTML = "";
        empty.classList.toggle("hidden", notifications.length > 0);

        notifications.forEach(notification => {
            const item = document.createElement("div");
            item.className = "notification-item";

            const icon = document.createElement("div");
            icon.className = "notification-item-icon";
            icon.innerHTML = `<span class="material-icons">${notification.type === "medication" ? "medication" : "notifications"}</span>`;

            const body = document.createElement("div");
            const title = document.createElement("div");
            const message = document.createElement("div");
            const time = document.createElement("div");

            title.className = "notification-title";
            message.className = "notification-message";
            time.className = "notification-time";

            title.textContent = notification.pet_name
                ? `${notification.title || "Notification"} - ${notification.pet_name}`
                : notification.title || "Notification";
            message.textContent = notification.message || "";
            time.textContent = formatNotificationTime(notification.created_at);

            body.appendChild(title);
            body.appendChild(message);
            body.appendChild(time);
            item.appendChild(icon);
            item.appendChild(body);
            list.appendChild(item);
        });
    }

    async function loadNotifications() {
        try {
            const pets = await getNotificationPets();
            lastPetIds = uniq(pets.map(pet => pet.id));

            if (pets.length === 0) {
                setCount(0);
                renderNotifications([]);
                return;
            }

            await Promise.all(pets.map(pet => syncNotifications(pet.id)));
            const batches = await Promise.all(pets.map(getUnreadNotifications));
            const notifications = batches
                .flat()
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setCount(notifications.length);
            renderNotifications(notifications);
        } catch (error) {
            console.error("Notification error:", error);
            countText.textContent = "Could not load notifications";
        }
    }

    window.petziRefreshNotifications = loadNotifications;

    bell.addEventListener("click", event => {
        event.stopPropagation();
        const isOpen = panel.classList.toggle("hidden") === false;
        bell.classList.toggle("open", isOpen);
        if (isOpen) loadNotifications();
    });

    document.addEventListener("click", event => {
        if (!panel.classList.contains("hidden") && !panel.contains(event.target) && !bell.contains(event.target)) {
            panel.classList.add("hidden");
            bell.classList.remove("open");
        }
    });

    const petSelector = document.getElementById("header-pet-selector");
    if (petSelector) {
        petSelector.addEventListener("change", loadNotifications);
    }

    window.addEventListener("petzi:notifications-refresh", loadNotifications);

    markRead.addEventListener("click", async () => {
        try {
            const petIds = lastPetIds.length ? lastPetIds : uniq((await getNotificationPets()).map(pet => pet.id));
            await Promise.all(petIds.map(petId => authFetch(`/api/notifications/read/${petId}`, { method: "PUT" })));
            await loadNotifications();
        } catch (error) {
            console.error("Could not mark notifications as read:", error);
        }
    });

    loadNotifications();
    setInterval(loadNotifications, 10000);
})();
