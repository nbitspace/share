package com.dbsync.data;

public enum CompletionStatus {
    NOT_COMPLETED(0),
    PROCESSING(1),
    COMPLETED(2);

    private int val;

    private CompletionStatus(int val) {
        this.val = val;
    }

    public int getVal() {
        return this.val;
    }
}
