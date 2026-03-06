import Map "mo:core/Map";
import Text "mo:core/Text";
import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Int "mo:core/Int";
import Iter "mo:core/Iter";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Migration "migration";

(with migration = Migration.run)
actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  public type UserProfile = {
    name : Text;
  };

  public type MangaStatus = {
    #Reading;
    #Completed;
    #OnHold;
    #Dropped;
    #PlanToRead;
    #Incomplete;
  };

  public type MangaEntry = {
    id : Text;
    title : Text;
    synopsis : Text;
    altTitle1 : Text;
    altTitle2 : Text;
    status : MangaStatus;
    currentChapter : Nat;
    totalChapters : ?Nat;
    rating : ?Nat;
    artRating : ?Float;
    cenLvl : ?Float;
    coverImageUrl : ?Text;
    notes : Text;
    genres : [Text];
    createdAt : Int.Int;
    updatedAt : Int.Int;
    isFavourite : Bool;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let userMangas = Map.empty<Principal, List.List<MangaEntry>>();

  // Authentication Functions
  public shared ({ caller }) func registerCaller() : async () {
    // Idempotent: silently skip if already registered as user or admin
    let currentRole = AccessControl.getUserRole(accessControlState, caller);
    switch (currentRole) {
      case (#user) { return }; // Already registered as user
      case (#admin) { return }; // Already an admin, no need to register
      case (#guest) {
        // Only guests need registration - assign user role to self
        AccessControl.assignRole(accessControlState, caller, caller, #user);
      };
    };
  };

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };
    userProfiles.add(caller, profile);
  };

  // Manga Management Functions
  public query ({ caller }) func getEntries() : async [MangaEntry] {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
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
    artRating : ?Float,
    cenLvl : ?Float,
    coverImageUrl : ?Text,
    notes : Text,
    genres : [Text],
    isFavourite : Bool,
  ) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    let now = Time.now();

    let entry : MangaEntry = {
      id = Time.now().toText();
      title;
      synopsis;
      altTitle1;
      altTitle2;
      status;
      currentChapter;
      totalChapters;
      rating;
      artRating;
      cenLvl;
      coverImageUrl;
      notes;
      genres;
      createdAt = now;
      updatedAt = now;
      isFavourite;
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
    artRating : ?Float,
    cenLvl : ?Float,
    coverImageUrl : ?Text,
    notes : Text,
    genres : [Text],
    isFavourite : Bool,
  ) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
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
              artRating;
              cenLvl;
              coverImageUrl;
              notes;
              genres;
              createdAt = e.createdAt;
              updatedAt = Time.now();
              isFavourite;
            };
          }
        );

        if (not found) { Runtime.trap("Entry not found") };
        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func deleteEntry(id : Text) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
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

  public shared ({ caller }) func toggleFavourite(id : Text) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            { e with isFavourite = not e.isFavourite; updatedAt = Time.now() };
          }
        );

        if (not found) { Runtime.trap("Entry not found") };

        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateStatus(id : Text, status : MangaStatus) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            { e with status; updatedAt = Time.now() };
          }
        );

        if (not found) { Runtime.trap("Entry not found") };
        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateChapters(
    id : Text,
    currentChapter : Nat,
    totalChapters : ?Nat,
  ) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            { e with currentChapter; totalChapters; updatedAt = Time.now() };
          }
        );

        if (not found) { Runtime.trap("Entry not found") };
        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateRating(id : Text, rating : ?Nat) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            { e with rating; updatedAt = Time.now() };
          }
        );
        if (not found) { Runtime.trap("Entry not found") };
        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateArtRating(id : Text, artRating : ?Float) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            { e with artRating; updatedAt = Time.now() };
          }
        );
        if (not found) { Runtime.trap("Entry not found") };
        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateCenLvl(id : Text, cenLvl : ?Float) : async MangaEntry {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized");
    };

    switch (userMangas.get(caller)) {
      case (null) { Runtime.trap("Entry not found") };
      case (?entries) {
        var found = false;
        let updatedEntries = entries.map<MangaEntry, MangaEntry>(
          func(e) {
            if (e.id != id) { return e };
            found := true;
            { e with cenLvl; updatedAt = Time.now() };
          }
        );
        if (not found) { Runtime.trap("Entry not found") };
        entries.clear();
        entries.addAll(updatedEntries.values());

        switch (entries.toArray().values().find(func(e) { e.id == id })) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };
};
