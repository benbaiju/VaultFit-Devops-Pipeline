import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/messaging";
import { useAuth } from "../state/auth-context";

export function NotificationsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(token),
  });

  const markOneMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(token, notificationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = notificationsQuery.data ?? [];

  return (
    <section>
      <div className="section-head">
        <h2>Notifications</h2>
        <button className="secondary-btn" disabled={markAllMutation.isPending} onClick={() => markAllMutation.mutate()}>
          Mark all as read
        </button>
      </div>

      <div className="card">
        {notificationsQuery.isLoading ? <p>Loading notifications...</p> : null}
        <ul className="list">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <span>
                <b>{notification.title}</b> - {notification.body}
                <span className={`badge ${notification.is_read ? "badge-muted" : "badge-success"}`}>
                  {notification.is_read ? "Read" : "Unread"}
                </span>
              </span>
              {!notification.is_read ? (
                <button
                  className="secondary-btn"
                  disabled={markOneMutation.isPending}
                  onClick={() => markOneMutation.mutate(notification.id)}
                >
                  Mark read
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
