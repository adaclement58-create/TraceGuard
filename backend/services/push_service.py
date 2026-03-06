# Push Notification Service for TRACEGUARD
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

logger = logging.getLogger(__name__)

async def store_push_subscription(db, user_email: str, subscription: dict) -> bool:
    """Store push subscription for a user"""
    try:
        await db.push_subscriptions.update_one(
            {"user_email": user_email},
            {
                "$set": {
                    "user_email": user_email,
                    "subscription": subscription,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        return True
    except Exception as e:
        logger.error(f"Failed to store push subscription: {e}")
        return False


async def remove_push_subscription(db, user_email: str) -> bool:
    """Remove push subscription for a user"""
    try:
        await db.push_subscriptions.delete_one({"user_email": user_email})
        return True
    except Exception as e:
        logger.error(f"Failed to remove push subscription: {e}")
        return False


async def send_push_notification(
    db,
    user_email: str,
    title: str,
    body: str,
    data: Optional[dict] = None
) -> bool:
    """Send push notification to a user"""
    try:
        sub_doc = await db.push_subscriptions.find_one({"user_email": user_email})
        if not sub_doc:
            logger.info(f"No push subscription for {user_email}")
            return False
        
        # Store notification for polling (fallback)
        await db.pending_notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_email": user_email,
            "title": title,
            "body": body,
            "data": data or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "read": False
        })
        
        # In production, use pywebpush to actually send the notification
        # from pywebpush import webpush
        # webpush(
        #     subscription_info=sub_doc["subscription"],
        #     data=json.dumps({"title": title, "body": body, "data": data}),
        #     vapid_private_key=VAPID_PRIVATE_KEY,
        #     vapid_claims={"sub": "mailto:admin@traceguard.com"}
        # )
        
        logger.info(f"Push notification stored for {user_email}")
        return True
    except Exception as e:
        logger.error(f"Push notification error: {e}")
        return False


async def send_bulk_push_notification(
    db,
    user_emails: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None
) -> int:
    """Send push notification to multiple users"""
    sent_count = 0
    for email in user_emails:
        if await send_push_notification(db, email, title, body, data):
            sent_count += 1
    return sent_count


async def get_pending_notifications(
    db,
    user_email: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """Get pending notifications for a user"""
    notifications = await db.pending_notifications.find(
        {"user_email": user_email, "read": False}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for n in notifications:
        n.pop("_id", None)
    
    return notifications


async def mark_notification_read(
    db,
    notification_id: str,
    user_email: str
) -> bool:
    """Mark a notification as read"""
    try:
        result = await db.pending_notifications.update_one(
            {"id": notification_id, "user_email": user_email},
            {"$set": {"read": True}}
        )
        return result.modified_count > 0
    except Exception as e:
        logger.error(f"Failed to mark notification read: {e}")
        return False
