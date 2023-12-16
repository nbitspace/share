package com.dbsync.syncentity;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.dbsync.data.MyTable;

@Repository
public interface MyTableRepository extends JpaRepository<MyTable, Long> {

    List<MyTable> findTop2ByCompletionStatus(Integer completionStatus);

    // @Query("SELECT mt FROM MyTable mt WHERE mt.completionStatus = :completionStatus ORDER BY mt.someOrderColumn DESC LIMIT :limit")
    // List<MyTable> findTopNByCompletionStatus(@Param("completionStatus") Integer completionStatus, @Param("limit") int limit);

}