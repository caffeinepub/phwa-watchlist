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

(with migration = Migration.run)
actor {
  // Initialize the access control system
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
    coverImageUrl : ?Text;
    notes : Text;
    genres : [Text];
    createdAt : Int;
    updatedAt : Int;
    isFavourite : Bool;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let userMangas = Map.empty<Principal, List.List<MangaEntry>>();

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Manga Management Functions
  public query ({ caller }) func getEntries() : async [MangaEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access manga entries");
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
    isFavourite : Bool,
  ) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can add manga entries");
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
    coverImageUrl : ?Text,
    notes : Text,
    genres : [Text],
    isFavourite : Bool,
  ) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update manga entries");
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
              isFavourite;
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
      Runtime.trap("Unauthorized: Only users can delete manga entries");
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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can toggle favourite status");
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

        switch (updatedEntries.last()) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateStatus(id : Text, status : MangaStatus) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update manga status");
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

        switch (updatedEntries.last()) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateChapters(id : Text, currentChapter : Nat, totalChapters : ?Nat) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update manga chapters");
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

        switch (updatedEntries.last()) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };

  public shared ({ caller }) func updateRating(id : Text, rating : ?Nat) : async MangaEntry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update manga rating");
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

        switch (updatedEntries.last()) {
          case (?entry) { entry };
          case (null) { Runtime.trap("Should not be possible") };
        };
      };
    };
  };
};
