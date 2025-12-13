"use client";

import { useEffect, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Plus, Loader2, AtSign } from "lucide-react";
import { toast } from "sonner";
import { followAccount, getFollowedAccounts, unfollowAccount } from "../actions/account-actions";
import { useVaticUser } from "@/app/hooks/use-vatic-user";

interface ManageSourcesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSourcesDialog({ open, onOpenChange }: ManageSourcesDialogProps) {
  const { auth } = useVaticUser();
  const [handle, setHandle] = useState("");
  const [following, setFollowing] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load accounts when dialog opens
  useEffect(() => {
    if (open && auth.userId) {
      setLoading(true);
      getFollowedAccounts(auth.userId).then((data) => {
        setFollowing(data);
        setLoading(false);
      });
    }
  }, [open, auth.userId]);

  const handleFollow = () => {
    if (!handle || !auth.userId) return;

    startTransition(async () => {
      const res = await followAccount(auth.userId!, handle);
      if (res.success && res.data) {
        toast.success(`Followed @${res.data.handle}`);
        setFollowing((prev) => [...prev, res.data]);
        setHandle("");
      } else {
        toast.error(res.error || "Failed to follow");
      }
    });
  };

  const handleUnfollow = (targetHandle: string) => {
    if (!auth.userId) return;
    // Optimistic update
    const previous = following;
    setFollowing((prev) => prev.filter((i) => i.handle !== targetHandle));

    startTransition(async () => {
      const res = await unfollowAccount(auth.userId!, targetHandle);
      if (!res.success) {
        toast.error("Failed to unfollow");
        setFollowing(previous); // Revert
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0F1115] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
          <DialogDescription className="text-white/50">
            Add Twitter accounts to your semantic correlation engine.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <AtSign className="absolute left-2.5 top-2.5 h-4 w-4 text-white/40" />
              <Input
                placeholder="elonmusk"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleFollow()}
                className="pl-9 bg-white/5 border-white/10 focus-visible:ring-blue-500"
              />
            </div>
            <Button 
              onClick={handleFollow} 
              disabled={isPending || !handle}
              className="bg-blue-600 hover:bg-blue-500 text-white min-w-[80px]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>

          <div className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Currently Following ({following.length})
            </h4>
            
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin text-white/30"/></div>
            ) : following.length === 0 ? (
              <div className="text-center py-8 text-white/20 text-sm border border-dashed border-white/10 rounded-lg">
                No accounts added yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {following.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-md border border-white/10">
                        <AvatarImage src={acc.profile_picture} />
                        <AvatarFallback className="rounded-md bg-white/10 text-xs">
                          {acc.handle[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-white/90">
                          {acc.display_name || `@${acc.handle}`}
                        </span>
                        <span className="text-xs text-white/50">@{acc.handle}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleUnfollow(acc.handle)}
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}