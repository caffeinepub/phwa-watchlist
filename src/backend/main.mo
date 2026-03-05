import Map "mo:core/Map";
import Text "mo:core/Text";
import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Int "mo:core/Int";
import Migration "migration";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

// Specify the migration in the with-clause
(with migration = Migration.run)
actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  type MangaStatus = {
    #Reading;
    #Completed;
    #OnHold;
    #Dropped;
    #PlanToRead;
  };

  type MangaEntry = {
    id : Text;
    title : Text;
    synopsis : Text;
    altTitle1 : Text;
    altTitle2 : Text;
    status : MangaStatus;
    currentChapter : Nat;
    totalChapters : ?Nat;
    rating : ?Nat;
    coverImageUrl : ?Text;
    notes : Text;
    genres : [Text];
    createdAt : Int;
    updatedAt : Int;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let userMangas = Map.empty<Principal, List.List<MangaEntry>>();
  
  // New stable map for trusted principals
  let trustedPrincipals = Map.empty<Principal, Bool>();

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access user profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save their profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Manga Management Functions
  public query ({ caller }) func getEntries() : async [MangaEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access entries");
    };
    switch (userMangas.get(caller)) {
      case (null) { [] };
      case (?entries) { entries.toArray() };
    };
  };

  public shared ({ caller }) func addEntry(
    title : Text,
    synopsis : Text,
    altTitle1 : Text,
    altTitle2 : Text,
    status : MangaStatus,
    currentChapter : Nat,
    totalChapters : ?Nat,
    rating : ?Nat,
    coverImageUrl : ?Text,
    notes : Text,
    genres : [Text],
  ) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add entries");
    };
    let now = Time.now();

    let entry = {
      id = Time.now().toText();
      title;
      synopsis;
      altTitle1;
      altTitle2;
      status;
      currentChapter;
      totalChapters;
      rating;
      coverImageUrl;
      notes;
      genres;
      createdAt = now;
      updatedAt = now;
    };

    let currentEntries = switch (userMangas.get(caller)) {
      case (null) {
        let newList = List.empty<MangaEntry>();
        userMangas.add(caller, newList);
        newList;
      };
      case (?list) { list };
    };
    currentEntries.add(entry);

    entry;
  };

  public shared ({ caller }) func updateEntry(
    id : Text,
    title : Text,
    synopsis : Text,
    altTitle1 : Text,
    altTitle2 : Text,
    status : MangaStatus,
    currentChapter : Nat,
    totalChapters : ?Nat,
    rating : ?Nat,
    coverImageUrl : ?Text,
    notes : Text,
    genres : [Text],
  ) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update entries");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            {
              id = e.id;
              title;
              synopsis;
              altTitle1;
              altTitle2;
              status;
              currentChapter;
              totalChapters;
              rating;
              coverImageUrl;
              notes;
              genres;
              createdAt = e.createdAt;
              updatedAt = Time.now();
            };
          }
        );

        if (not found) { Runtime.trap("Entry not found") };

        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (updatedEntries.last()) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func deleteEntry(id : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete entries");
    };
    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let filteredEntries = entries.filter(
          func(e) {
            let keep = e.id != id;
            if (not keep) { found := true };
            keep;
          }
        );

        if (not found) { Runtime.trap("Entry not found") };

        entries.clear();
        entries.addAll(filteredEntries.values());
      };
    };
  };
  
  // Trusted Principal Functions
  public query ({ caller }) func checkTrusted(user: Principal) : async Bool {
    switch (trustedPrincipals.get(user)) {
      case (?trusted) { trusted };
      case (null) { false };
    };
  };

  public shared ({ caller }) func markTrusted() : async () {
    if (caller.isAnonymous()) {
      Runtime.trap("Anonymous principals cannot be marked as trusted");
    };
    trustedPrincipals.add(caller, true);
  };
};

